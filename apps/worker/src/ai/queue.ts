/**
 * F5-4 · Cola de trabajos de IA (`ai_jobs`).
 *
 * La web inserta una pregunta; un NOTIFY despierta al worker, que la responde en segundos.
 * Además el planificador revisa la cola cada minuto por si se perdió el aviso.
 *
 * - AI_PROVIDER distinto de `claude_cli` → la pregunta se cierra con un mensaje claro.
 * - Tope diario de la configuración del asistente: se cuentan los trabajos que llegaron a
 *   ejecutarse hoy (hora de Madrid); al alcanzarlo, las nuevas preguntas se cierran sin llamar a Claude.
 * - Las preguntas se atienden de una en una y en orden de llegada.
 */
import pg from "pg";
import { connect, USER_ID } from "../db.ts";
import { log } from "../jobs.ts";
import { runClaude } from "./claude.ts";
import { buildContext, loadSettings, systemPrompt } from "./context.ts";

const provider = () => (process.env.AI_PROVIDER ?? "none").trim();

async function close(db: pg.Client, id: string, status: "done" | "error", fields: { output?: object; error?: string; provider?: string | null; model?: string; usage?: object }) {
  await db.query(
    `update public.ai_jobs set status = $2, output = $3, error = $4, provider = coalesce($5, provider), model = coalesce($6, model),
            usage = $7, finished_at = now() where id = $1`,
    [id, status, fields.output ? JSON.stringify(fields.output) : null, fields.error ?? null, fields.provider ?? null, fields.model ?? null, fields.usage ? JSON.stringify(fields.usage) : null],
  );
}

async function usedToday(db: pg.Client, uid: string) {
  const { rows } = await db.query<{ n: string }>(
    `select count(*) n from public.ai_jobs where user_id = $1 and provider = 'claude_cli'
        and started_at >= (date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid')`,
    [uid],
  );
  return Number(rows[0].n);
}

/** Atiende todas las preguntas en cola. Devuelve cuántas ha cerrado. */
export async function processAiJobs(db: pg.Client): Promise<number> {
  const uid = USER_ID();
  let handled = 0;
  // Preguntas que quedaron a medias si el worker se reinició mientras respondía.
  await db.query(
    `update public.ai_jobs set status = 'error', error = 'Interrumpida al reiniciarse el worker. Vuelve a preguntar.', finished_at = now()
      where user_id = $1 and status = 'running' and started_at < now() - interval '5 minutes'`,
    [uid],
  );
  for (;;) {
    // Reclamar la más antigua: pasa a «running» en la misma sentencia.
    const { rows } = await db.query<{ id: string; kind: string; input: { question?: string } }>(
      `update public.ai_jobs set status = 'running', started_at = now()
        where id = (select id from public.ai_jobs where user_id = $1 and status = 'queued' order by created_at limit 1 for update skip locked)
        returning id, kind, input`,
      [uid],
    );
    const job = rows[0];
    if (!job) return handled;
    handled++;
    const question = String(job.input?.question ?? "").trim().slice(0, 1000);

    if (job.kind !== "assistant" || !question) {
      await close(db, job.id, "error", { error: "Trabajo no válido." });
      continue;
    }
    if (provider() !== "claude_cli") {
      await close(db, job.id, "error", { error: "La IA está desactivada en el Mac mini (AI_PROVIDER=none). Las preguntas rápidas siguen funcionando." });
      continue;
    }

    const settings = await loadSettings(db, uid);
    // Este trabajo ya cuenta como iniciado, así que el tope se compara con «más que».
    await db.query("update public.ai_jobs set provider = 'claude_cli' where id = $1", [job.id]);
    if ((await usedToday(db, uid)) > settings.daily_cap) {
      await db.query("update public.ai_jobs set provider = null where id = $1", [job.id]);
      await close(db, job.id, "error", { error: `Tope diario alcanzado (${settings.daily_cap} preguntas). Puedes subirlo en Asistente → Configuración.` });
      continue;
    }

    try {
      const ctx = await buildContext(db, uid, question, settings);
      const prompt = `Información disponible:\n\n${ctx.text || "(ninguna fuente activada)"}\n\n---\nPregunta: ${question}`;
      const r = await runClaude({ system: systemPrompt(settings), prompt, model: settings.model_quick });
      const cited = new Set([...r.text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
      const sources = ctx.sources.filter((s) => cited.has(s.n));
      await close(db, job.id, "done", {
        output: { answer: r.text, sources, context_blocks: ctx.sources.length },
        model: settings.model_quick,
        usage: r.usage,
      });
      log(`asistente: ok · ${settings.model_quick} · ${(r.usage.duration_ms / 1000).toFixed(1)} s · ${r.usage.input_tokens + r.usage.cache_read_tokens}+${r.usage.output_tokens} tokens`);
    } catch (e) {
      await close(db, job.id, "error", { error: `No se pudo responder: ${(e as Error).message}` });
      log(`asistente: ERROR · ${(e as Error).message}`);
    }
  }
}

let running = false;
let again = false;

/** Atiende la cola sin solaparse: si llega otro aviso mientras tanto, repite al terminar. */
export async function drainAiQueue() {
  if (running) { again = true; return; }
  running = true;
  try {
    do {
      again = false;
      const db = await connect();
      try { await processAiJobs(db); } finally { await db.end().catch(() => {}); }
    } while (again);
  } catch (e) {
    log(`asistente: ${(e as Error).message}`);
  } finally {
    running = false;
  }
}

/** Conexión permanente con LISTEN ai_jobs; se reconecta sola si se corta. */
export async function listenAiJobs(stopping: () => boolean) {
  const start = async () => {
    if (stopping()) return;
    try {
      const db = await connect();
      let lost = false;
      const reconnect = (why: string) => {
        if (lost) return;
        lost = true;
        db.end().catch(() => {});
        if (stopping()) return;
        log(`asistente: escucha cortada (${why}); se reconecta en 30 s`);
        setTimeout(start, 30_000);
      };
      db.on("notification", () => void drainAiQueue());
      db.on("error", (e) => reconnect(e.message));
      db.on("end", () => reconnect("conexión cerrada"));
      await db.query("listen ai_jobs");
      void drainAiQueue(); // lo que llegara mientras no se escuchaba
    } catch (e) {
      log(`asistente: no se pudo escuchar la cola · ${(e as Error).message}`);
      setTimeout(start, 60_000);
    }
  };
  await start();
}

/*
 *   npm run ai:ask --workspace apps/worker -- "pregunta"             la encola y la responde como el worker
 *   npm run ai:ask --workspace apps/worker -- "pregunta" --context   solo muestra el contexto que se enviaría
 */
if (import.meta.main) {
  const question = process.argv.slice(2).filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!question) { console.error("Escribe la pregunta entre comillas."); process.exit(1); }
  const db = await connect();
  try {
    const uid = USER_ID();
    if (process.argv.includes("--context")) {
      const settings = await loadSettings(db, uid);
      const ctx = await buildContext(db, uid, question, settings);
      console.log(systemPrompt(settings), "\n\n=====\n", ctx.text, `\n\n(${ctx.text.length} caracteres, ${ctx.sources.length} bloques)`);
    } else {
      const { rows } = await db.query("insert into public.ai_jobs (user_id, kind, input) values ($1, 'assistant', $2) returning id", [uid, JSON.stringify({ question })]);
      await processAiJobs(db);
      const r = await db.query("select status, output, error, model, usage from public.ai_jobs where id = $1", [rows[0].id]);
      console.log(JSON.stringify(r.rows[0], null, 2));
    }
  } finally {
    await db.end();
  }
}

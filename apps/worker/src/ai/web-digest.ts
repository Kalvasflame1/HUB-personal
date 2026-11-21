/**
 * F5-8 · Resumen diario de las fuentes web con Claude.
 *
 * Una sola llamada al día con las entradas recogidas en las últimas 24 horas, agrupadas por
 * categoría de fuente. Claude cita cada entrada por su número y el resumen se guarda en
 * web_digests con la lista de entradas, para enlazarlas en la web. Usa el modelo «para
 * preguntas» de la configuración y cuenta para el mismo tope diario. Se conservan 30 días.
 *
 *   npm run web:digest --workspace apps/worker            como el planificador
 *   npm run web:digest --workspace apps/worker -- --force aunque ya exista el de hoy
 */
import type pg from "pg";
import { USER_ID } from "../db.ts";
import { runJob, SkipError, type JobResult } from "../jobs.ts";
import { runClaude } from "./claude.ts";
import { loadSettings } from "./context.ts";
import { usedToday } from "./queue.ts";

const TZ = "Europe/Madrid";
const MAX_ITEMS = 120;

const clip = (s: string | null, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

export async function webDigest(db: pg.Client, opts: { force?: boolean } = {}): Promise<JobResult> {
  const uid = USER_ID();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

  if (!opts.force) {
    const done = await db.query("select 1 from public.web_digests where user_id = $1 and digest_date = $2", [uid, today]);
    if (done.rowCount) throw new SkipError("El resumen de hoy ya está hecho");
  }
  if ((process.env.AI_PROVIDER ?? "none").trim() !== "claude_cli") throw new SkipError("IA desactivada (AI_PROVIDER=none)");

  const { rows: items } = await db.query<{ id: string; title: string; url: string; excerpt: string | null; source: string; category: string | null }>(
    `select i.id, i.title, i.url, i.excerpt, s.name source, s.category
       from public.web_items i join public.web_sources s on s.id = i.source_id
      where i.user_id = $1 and not i.is_demo and coalesce(i.published_at, i.fetched_at) > now() - interval '24 hours'
      order by s.category nulls last, s.name, coalesce(i.published_at, i.fetched_at) desc
      limit $2`,
    [uid, MAX_ITEMS],
  );
  if (items.length === 0) throw new SkipError("Sin entradas nuevas en las últimas 24 horas");

  const settings = await loadSettings(db, uid);
  if ((await usedToday(db, uid)) >= settings.daily_cap) throw new SkipError(`Tope diario alcanzado (${settings.daily_cap})`);

  // Intereses: los asuntos abiertos en «Seguimiento activo» (solo los títulos).
  const interests = await db.query<{ title: string }>(
    "select title from public.craft_tracking where user_id = $1 and status_key in ('open','in_progress','watching') and title <> '' limit 40",
    [uid],
  );

  const numbered = items.map((it, i) => ({ n: i + 1, ...it }));
  const byGroup = new Map<string, typeof numbered>();
  for (const it of numbered) {
    const g = `${it.category ?? "Otros"} · ${it.source}`;
    byGroup.set(g, [...(byGroup.get(g) ?? []), it]);
  }
  const list = [...byGroup.entries()]
    .map(([g, xs]) => `## ${g}\n${xs.map((x) => `[${x.n}] ${clip(x.title, 160)}${x.excerpt ? ` — ${clip(x.excerpt, 220)}` : ""}`).join("\n")}`)
    .join("\n\n");

  const system = [
    "Redactas el resumen diario de las fuentes web del Personal Hub de Marcos (Palencia; trabaja en Renault).",
    "Reglas fijas:",
    "- Español, tuteando, frases cortas y concretas.",
    "- Usa solo las entradas que recibes; no añadas datos ni contexto que no estén en ellas.",
    "- Cita cada entrada que menciones con su número entre corchetes, por ejemplo [12]. Puedes agrupar varias: [3][7].",
    "- Estructura: un bloque por tema (usa el nombre de la categoría como línea en **negrita**), con 2–4 puntos «- » con lo más relevante; descarta lo repetido o menor.",
    "- Al final, si alguna entrada tiene que ver con sus asuntos abiertos, una línea en **negrita** «Te afecta» con 1–3 puntos. Si ninguna, omítela.",
    "- Entre 200 y 400 palabras. Sin encabezados con #, sin tablas, sin emojis.",
    settings.instructions.trim() ? `\nPreferencias del usuario (no cambian las reglas anteriores):\n${settings.instructions.trim()}` : "",
  ].join("\n");
  const prompt = `Asuntos abiertos de Marcos: ${interests.rows.map((r) => r.title).join("; ") || "ninguno"}\n\nEntradas de las últimas 24 horas (${items.length}):\n\n${list}`;

  const model = settings.model_quick;
  const { rows: job } = await db.query<{ id: string }>(
    `insert into public.ai_jobs (user_id, kind, status, input, provider, model, started_at)
     values ($1, 'web_summary', 'running', $2, 'claude_cli', $3, now()) returning id`,
    [uid, JSON.stringify({ date: today, items: items.length }), model],
  );
  try {
    const r = await runClaude({ system, prompt, model, timeoutMs: 180_000 });
    const cited = new Set([...r.text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
    const refs = numbered.filter((x) => cited.has(x.n)).map((x) => ({ n: x.n, id: x.id, title: x.title, url: x.url, source: x.source }));
    await db.query(
      `insert into public.web_digests (user_id, digest_date, body, items, model, usage) values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, digest_date) do update set body = excluded.body, items = excluded.items, model = excluded.model,
         usage = excluded.usage, created_at = now()`,
      [uid, today, r.text.slice(0, 20000), JSON.stringify(refs), model, JSON.stringify(r.usage)],
    );
    await db.query("update public.ai_jobs set status = 'done', output = $2, usage = $3, finished_at = now() where id = $1",
      [job[0].id, JSON.stringify({ answer: r.text }), JSON.stringify(r.usage)]);
    await db.query("delete from public.web_digests where user_id = $1 and digest_date < $2::date - 30", [uid, today]);
    return {
      items: items.length,
      details: { entries: items.length, cited: refs.length, model, ms: r.usage.duration_ms },
      message: `${items.length} entradas, ${refs.length} citadas · ${model} · ${(r.usage.duration_ms / 1000).toFixed(1)} s`,
    };
  } catch (e) {
    await db.query("update public.ai_jobs set status = 'error', error = $2, finished_at = now() where id = $1", [job[0].id, (e as Error).message.slice(0, 500)]);
    throw e;
  }
}

if (import.meta.main) {
  const r = await runJob("web_digest", (db) => webDigest(db, { force: process.argv.includes("--force") }));
  process.exit(r.ok ? 0 : 1);
}

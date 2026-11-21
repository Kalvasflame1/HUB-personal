/**
 * F5-7 · Comentario redactado por Claude para los informes semanal y mensual.
 *
 * Recibe las cifras ya calculadas con SQL (la plantilla) y el detalle del periodo, y devuelve un
 * texto que las comenta. No calcula nada nuevo. Usa el modelo «para informes» de la configuración
 * del asistente, cuenta para el mismo tope diario que las preguntas y queda registrado en ai_jobs.
 * Si la IA está apagada, se alcanzó el tope o Claude falla, devuelve null con el motivo y el
 * informe se guarda sin comentario.
 */
import type pg from "pg";
import { runClaude } from "./claude.ts";
import { loadSettings } from "./context.ts";
import { usedToday } from "./queue.ts";

const TZ = "Europe/Madrid";

type Input = { kind: "weekly" | "monthly"; start: string; end: string; title: string; body: string };

async function periodDetail(db: pg.Client, uid: string, start: string, end: string, kind: Input["kind"]) {
  const runs = await db.query(
    `select start_date_local::date::text d, name, sport_type, round(distance_m / 1000.0, 1) km, moving_time_s,
            round(average_heartrate) hr, suffer_score
       from public.strava_activities where user_id = $1 and not is_demo and start_date_local::date between $2 and $3
      order by start_date_local`, [uid, start, end]);
  const tasks = await db.query(
    `select title, (completed_at at time zone '${TZ}')::date::text d from public.tasks
      where user_id = $1 and not is_demo and (completed_at at time zone '${TZ}')::date between $2 and $3 order by completed_at`, [uid, start, end]);
  const tracking = await db.query(
    `select title, status, due_date::text due from public.craft_tracking
      where user_id = $1 and status_key in ('open','in_progress','watching') order by due_date nulls last limit 30`, [uid]);
  const events = await db.query(
    `select event_date::text d, end_date::text e, raw from public.craft_events
      where user_id = $1 and event_date between (now() at time zone '${TZ}')::date and (now() at time zone '${TZ}')::date + $2::int
      order by event_date, position limit 30`, [uid, kind === "weekly" ? 7 : 31]);

  const lines = [
    "Actividades del periodo (Strava):",
    ...(runs.rows.length ? runs.rows.map((r) => `- ${r.d} · ${r.sport_type} · ${r.name} · ${String(r.km).replace(".", ",")} km · ${Math.round(r.moving_time_s / 60)} min${r.hr ? ` · FC ${r.hr}` : ""}${r.suffer_score != null ? ` · esfuerzo ${r.suffer_score}` : ""}`) : ["- Ninguna."]),
    "",
    "Tareas completadas en el periodo:",
    ...(tasks.rows.length ? tasks.rows.map((r) => `- ${r.d}: ${r.title}`) : ["- Ninguna."]),
    "",
    "Asuntos abiertos ahora en «Seguimiento activo» (Craft):",
    ...(tracking.rows.length ? tracking.rows.map((r) => `- ${r.title} · ${String(r.status).replace(/^\S+\s/, "")}${r.due ? ` · fecha ${r.due}` : ""}`) : ["- Ninguno."]),
    "",
    `Próximos eventos (${kind === "weekly" ? "7" : "31"} días desde hoy):`,
    ...(events.rows.length ? events.rows.map((r) => `- ${r.d}${r.e ? ` a ${r.e}` : ""}: ${String(r.raw).replace(/\*\*/g, "").slice(0, 220)}`) : ["- Ninguno."]),
  ];
  return lines.join("\n");
}

function system(kind: Input["kind"], instructions: string) {
  return [
    `Redactas el comentario del informe ${kind === "weekly" ? "semanal" : "mensual"} del Personal Hub de Marcos.`,
    "Reglas fijas:",
    "- Español, tuteando, tono cercano y concreto.",
    "- Usa solo los datos que recibes. Las cifras deben aparecer tal cual; no calcules medias, porcentajes ni totales nuevos.",
    "- Si algo no está en los datos, no lo menciones ni lo supongas.",
    `- Extensión: ${kind === "weekly" ? "entre 120 y 220 palabras" : "entre 180 y 320 palabras"}.`,
    `- Estructura: un párrafo con lo más importante del periodo (running y tareas); un párrafo breve sobre tendencia frente al periodo anterior; y una lista corta titulada «${kind === "weekly" ? "Para la próxima semana" : "Para el próximo mes"}:» con ${kind === "weekly" ? "2–4" : "3–5"} puntos sacados de los asuntos abiertos y los próximos eventos.`,
    "- Texto plano: párrafos y listas con «- ». Puedes usar **negrita** con moderación. Sin encabezados, sin tablas, sin emojis.",
    instructions.trim() ? `\nPreferencias del usuario (no cambian las reglas anteriores):\n${instructions.trim()}` : "",
  ].join("\n");
}

export async function writeReportSummary(db: pg.Client, uid: string, r: Input): Promise<{ summary: string; model: string } | { skipped: string }> {
  if ((process.env.AI_PROVIDER ?? "none").trim() !== "claude_cli") return { skipped: "IA desactivada" };
  const settings = await loadSettings(db, uid);
  if ((await usedToday(db, uid)) >= settings.daily_cap) return { skipped: `tope diario alcanzado (${settings.daily_cap})` };

  const model = settings.model_reports;
  const { rows } = await db.query<{ id: string }>(
    `insert into public.ai_jobs (user_id, kind, status, input, provider, model, started_at)
     values ($1, 'report', 'running', $2, 'claude_cli', $3, now()) returning id`,
    [uid, JSON.stringify({ report: r.kind, start: r.start, end: r.end }), model],
  );
  const jobId = rows[0].id;
  try {
    const detail = await periodDetail(db, uid, r.start, r.end, r.kind);
    const prompt = `Informe: ${r.title} (${r.start} a ${r.end})\n\nCifras calculadas con SQL (plantilla):\n${r.body}\n\nDetalle:\n${detail}`;
    const res = await runClaude({ system: system(r.kind, settings.instructions), prompt, model, timeoutMs: 240_000 });
    await db.query(
      "update public.ai_jobs set status = 'done', output = $2, usage = $3, finished_at = now() where id = $1",
      [jobId, JSON.stringify({ answer: res.text }), JSON.stringify(res.usage)],
    );
    return { summary: res.text.slice(0, 12000), model };
  } catch (e) {
    const msg = (e as Error).message;
    await db.query("update public.ai_jobs set status = 'error', error = $2, finished_at = now() where id = $1", [jobId, msg.slice(0, 500)]);
    return { skipped: `Claude falló: ${msg.slice(0, 200)}` };
  }
}

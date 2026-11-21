/**
 * Informes diario, semanal y mensual con plantilla. Todas las cifras salen de SQL.
 * Semanal y mensual llevan además un comentario redactado por Claude si AI_PROVIDER=claude_cli
 * (F5-7); sin IA, o si falla, el informe se guarda igual, sin comentario.
 * Se guardan en public.reports; si se vuelven a generar para el mismo periodo, se actualizan.
 *
 *   npm run report --workspace apps/worker -- daily|weekly|monthly [--date=YYYY-MM-DD] [--no-ai]
 *   (--date es un día cualquiera dentro del periodo; por defecto, el periodo cerrado más reciente)
 */
import type pg from "pg";
import { USER_ID } from "./db.ts";
import { runJob, type JobResult } from "./jobs.ts";
import { writeReportSummary } from "./ai/report-writer.ts";

export type Kind = "daily" | "weekly" | "monthly";

const TZ = "Europe/Madrid";
const RUN_TYPES = ["Run", "TrailRun", "VirtualRun"];
const PR_NAMES: Record<string, string> = { "1K": "1 km", "5K": "5 km", "10K": "10 km", "Half-Marathon": "media maratón", Marathon: "maratón" };

// ---------- Fechas (día civil en Madrid, como "YYYY-MM-DD") ----------
export const todayMadrid = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
const parse = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = parse(iso); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };

/** Periodo cerrado que contiene `day` (o el más reciente antes de hoy si no se indica). */
export function period(kind: Kind, day?: string): { start: string; end: string } {
  const today = todayMadrid();
  if (kind === "daily") {
    const d = day ?? addDays(today, -1);
    return { start: d, end: d };
  }
  if (kind === "weekly") {
    const ref = day ?? addDays(today, -7);
    const dow = (parse(ref).getUTCDay() + 6) % 7; // lunes = 0
    const start = addDays(ref, -dow);
    return { start, end: addDays(start, 6) };
  }
  const ref = parse(day ?? fmt(new Date(Date.UTC(parse(today).getUTCFullYear(), parse(today).getUTCMonth() - 1, 15))));
  const start = fmt(new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1, 12)));
  const end = fmt(new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0, 12)));
  return { start, end };
}

function previous(kind: Kind, p: { start: string; end: string }) {
  if (kind === "daily") return period("daily", addDays(p.start, -1));
  if (kind === "weekly") return period("weekly", addDays(p.start, -7));
  return period("monthly", addDays(p.start, -1));
}

// ---------- Formato ----------
const nf1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const km = (m: number) => `${nf1.format(m / 1000)} km`;
const clock = (s: number) => {
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const longDate = (iso: string, opts: Intl.DateTimeFormatOptions) => parse(iso).toLocaleDateString("es-ES", { ...opts, timeZone: "UTC" });

// ---------- Cifras ----------
async function metrics(db: pg.Client, uid: string, start: string, end: string) {
  const q = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, [uid, start, end, ...params])).rows[0];

  const tasks = await q<{ done: string; created: string }>(
    `select
       count(*) filter (where (completed_at at time zone '${TZ}')::date between $2 and $3) as done,
       count(*) filter (where (created_at at time zone '${TZ}')::date between $2 and $3) as created
     from public.tasks where user_id = $1 and not is_demo`,
  );
  const runs = await q<{ n: string; m: string | null; s: string | null; longest: string | null; hr: string | null; load: string | null }>(
    `select count(*) n, sum(distance_m) m, sum(moving_time_s) s, max(distance_m) longest,
            round(avg(average_heartrate)) hr, sum(suffer_score) load
       from public.strava_activities
      where user_id = $1 and not is_demo and sport_type = any($4) and start_date_local::date between $2 and $3`,
    [RUN_TYPES],
  );
  const prs = await db.query<{ name: string; t: number }>(
    `select e.name, min(e.elapsed_time_s) t
       from public.strava_best_efforts e
      where e.user_id = $1 and e.pr_rank = 1 and e.name = any($4)
        and (e.start_date at time zone '${TZ}')::date between $2 and $3
      group by e.name`,
    [uid, start, end, Object.keys(PR_NAMES)],
  );
  const web = await q<{ n: string }>(
    `select count(*) n from public.web_items
      where user_id = $1 and not is_demo and (fetched_at at time zone '${TZ}')::date between $2 and $3`,
  );
  const jobs = await q<{ errors: string }>(
    `select count(*) filter (where status = 'error') errors from public.job_runs
      where user_id = $1 and (started_at at time zone '${TZ}')::date between $2 and $3`,
  );
  const meters = Number(runs.m ?? 0), seconds = Number(runs.s ?? 0);
  return {
    tasks_done: Number(tasks.done),
    tasks_created: Number(tasks.created),
    runs: Number(runs.n),
    km: Math.round(meters / 100) / 10,
    moving_time_s: seconds,
    pace_s_per_km: meters ? Math.round(seconds / (meters / 1000)) : null,
    longest_km: runs.longest ? Math.round(Number(runs.longest) / 100) / 10 : null,
    avg_hr: runs.hr ? Number(runs.hr) : null,
    load: runs.load ? Number(runs.load) : null,
    prs: prs.rows.map((r) => ({ distance: PR_NAMES[r.name], time_s: r.t })),
    web_items: Number(web.n),
    job_errors: Number(jobs.errors),
  };
}

async function pendingNow(db: pg.Client, uid: string) {
  const r = await db.query<{ pending: string; overdue: string }>(
    `select count(*) pending, count(*) filter (where due_date < (now() at time zone '${TZ}')::date) overdue
       from public.tasks where user_id = $1 and not is_demo and status in ('todo','doing')`,
    [uid],
  );
  return { pending: Number(r.rows[0].pending), overdue: Number(r.rows[0].overdue) };
}

// ---------- Redacción con plantilla ----------
function compose(kind: Kind, p: { start: string; end: string }, m: Awaited<ReturnType<typeof metrics>>, prev: Awaited<ReturnType<typeof metrics>>, now: { pending: number; overdue: number }) {
  const label = kind === "daily" ? "Ese día" : kind === "weekly" ? "Esa semana" : "Ese mes";
  const title =
    kind === "daily" ? `Resumen del ${longDate(p.start, { weekday: "long", day: "numeric", month: "long" })}`
    : kind === "weekly" ? `Semana del ${longDate(p.start, { day: "numeric", month: "long" })}`
    : `Resumen de ${longDate(p.start, { month: "long", year: "numeric" })}`;

  const lead = m.runs || m.tasks_done
    ? `${label} completaste ${plural(m.tasks_done, "tarea", "tareas")} y corriste ${km(m.km * 1000)} en ${plural(m.runs, "salida", "salidas")}.`
    : `${label} no hubo tareas completadas ni carreras registradas.`;

  const bullets: string[] = [];
  if (m.runs) {
    let line = `Running: ${km(m.km * 1000)}, ${clock(m.moving_time_s)} en movimiento`;
    if (m.pace_s_per_km) line += `, ritmo medio ${clock(m.pace_s_per_km)} min/km`;
    if (m.avg_hr) line += `, pulso medio ${m.avg_hr} ppm`;
    bullets.push(`${line}.`);
    if (m.longest_km && m.runs > 1) bullets.push(`Salida más larga: ${nf1.format(m.longest_km)} km.`);
  }
  if (kind !== "daily") {
    const diff = m.km - prev.km;
    const prevLabel = kind === "weekly" ? "la semana anterior" : "el mes anterior";
    const vs = kind === "weekly" ? "Frente a la semana anterior" : "Frente al mes anterior";
    bullets.push(
      prev.km || m.km
        ? `${vs}: ${diff >= 0 ? "+" : "−"}${nf1.format(Math.abs(diff))} km (${nf1.format(prev.km)} km en ${plural(prev.runs, "salida", "salidas")}).`
        : `Sin carreras tampoco en ${prevLabel}.`,
    );
  }
  for (const pr of m.prs) bullets.push(`Nueva marca personal en ${pr.distance}: ${clock(pr.time_s)}.`);
  bullets.push(`Tareas: ${m.tasks_done} completadas, ${m.tasks_created} creadas; ahora hay ${now.pending} pendientes${now.overdue ? `, ${now.overdue} vencidas` : ""}.`);
  if (m.web_items) bullets.push(`Fuentes web: ${plural(m.web_items, "entrada nueva", "entradas nuevas")}.`);
  if (m.job_errors) bullets.push(`Automatizaciones: ${plural(m.job_errors, "ejecución con error", "ejecuciones con error")} (ver Productividad).`);

  return { title, body: [lead, "", ...bullets.map((b) => `- ${b}`)].join("\n") };
}

export async function generateReport(db: pg.Client, kind: Kind, day?: string, opts: { ai?: boolean } = {}): Promise<JobResult> {
  const uid = USER_ID();
  const p = period(kind, day);
  const prevP = previous(kind, p);
  // Una sola conexión: las consultas van en serie
  const m = await metrics(db, uid, p.start, p.end);
  const prev = await metrics(db, uid, prevP.start, prevP.end);
  const now = await pendingNow(db, uid);
  const { title, body } = compose(kind, p, m, prev, now);

  // Comentario de Claude (solo semanal y mensual). Al volver a generar sin IA se conserva el anterior.
  let ai: { summary: string; model: string } | null = null;
  let aiNote = "";
  if (kind !== "daily" && opts.ai !== false) {
    const r = await writeReportSummary(db, uid, { kind, start: p.start, end: p.end, title, body });
    if ("summary" in r) ai = r;
    else aiNote = r.skipped;
  }

  const { rows } = await db.query<{ inserted: boolean }>(
    `insert into public.reports (user_id, kind, period_start, period_end, title, metrics, body_md, generated_by, ai_summary, ai_model, ai_generated_at)
     values ($1, $2, $3, $4, $5, $6, $7, 'template', $8, $9, case when $8::text is null then null else now() end)
     on conflict (user_id, kind, period_start) do update set
       period_end = excluded.period_end, title = excluded.title, metrics = excluded.metrics,
       body_md = excluded.body_md, generated_by = excluded.generated_by, is_demo = false,
       ai_summary = coalesce(excluded.ai_summary, reports.ai_summary),
       ai_model = coalesce(excluded.ai_model, reports.ai_model),
       ai_generated_at = coalesce(excluded.ai_generated_at, reports.ai_generated_at)
     returning (xmax = 0) as inserted`,
    [uid, kind, p.start, p.end, title, JSON.stringify({ ...m, previous: { km: prev.km, runs: prev.runs }, ...now }), body, ai?.summary ?? null, ai?.model ?? null],
  );
  if (rows[0]?.inserted) {
    await db.query(
      `insert into public.activity_log (user_id, kind, title, entity_type) values ($1, 'report_ready', $2, 'report')`,
      [uid, `${title} disponible`],
    );
  }
  const aiText = kind === "daily" ? "" : ai ? ` · comentario de Claude (${ai.model})` : ` · sin comentario: ${aiNote}`;
  return { items: 1, details: { kind, ...p, ai: ai ? ai.model : aiNote || null }, message: `${title} (${p.start} – ${p.end})${aiText}` };
}

if (import.meta.main) {
  const kind = process.argv[2] as Kind;
  if (!["daily", "weekly", "monthly"].includes(kind)) {
    console.error("Uso: npm run report --workspace apps/worker -- daily|weekly|monthly [--date=YYYY-MM-DD]");
    process.exit(1);
  }
  const day = process.argv.find((a) => a.startsWith("--date="))?.split("=")[1];
  const noAi = process.argv.includes("--no-ai");
  const r = await runJob(`report_${kind}`, (db) => generateReport(db, kind, day, { ai: !noAi }));
  if (!r.ok) process.exitCode = 1;
}

/**
 * Worker del Mac mini: planificador de tareas.
 *
 *   npm start --workspace apps/worker                 proceso permanente (lo que lanzará launchd)
 *   npm start --workspace apps/worker -- --once        ejecuta lo que esté pendiente y termina
 *   npm start --workspace apps/worker -- --run=NOMBRE  ejecuta una tarea ahora y termina
 *
 * Cada minuto comprueba qué tareas tocan. Una tarea toca si su última ejecución registrada en
 * job_runs es anterior a su último turno programado; así, si el Mac estuvo apagado o dormido,
 * al volver cada tarea se pone al día una sola vez. Las tareas se ejecutan de una en una.
 */
import { connect, USER_ID } from "./db.ts";
import { jobLabel, log, runJob, type JobFn } from "./jobs.ts";
import { syncStrava } from "./strava/sync.ts";
import { fetchWeb } from "./web/fetch.ts";
import { generateReport } from "./reports.ts";
import { backup } from "./backup.ts";
import { indexCraft } from "./craft/index.ts";

const TZ = "Europe/Madrid";

type Spec = {
  name: string;
  fn: JobFn;
  every?: number;      // minutos
  at?: string;         // "HH:MM", hora de Madrid
  weekday?: number;    // 0 = lunes
  monthday?: number;   // 1..28
  staleAfter: number;  // minutos sin ejecución correcta para avisar
};

const JOBS: Spec[] = [
  { name: "strava_sync", every: 30, fn: (db) => syncStrava(db, { details: 90 }), staleAfter: 6 * 60 },
  { name: "web_fetch", every: 120, fn: fetchWeb, staleAfter: 12 * 60 },
  { name: "report_daily", at: "06:30", fn: (db) => generateReport(db, "daily"), staleAfter: 26 * 60 },
  { name: "report_weekly", at: "07:00", weekday: 0, fn: (db) => generateReport(db, "weekly"), staleAfter: 8 * 24 * 60 },
  { name: "report_monthly", at: "07:00", monthday: 1, fn: (db) => generateReport(db, "monthly"), staleAfter: 32 * 24 * 60 },
  { name: "craft_index", every: 60, fn: (db) => indexCraft(db), staleAfter: 6 * 60 },
  { name: "backup", at: "03:30", fn: backup, staleAfter: 3 * 24 * 60 },
  { name: "watchdog", every: 60, fn: watchdog, staleAfter: 0 },
];

// ---------- Calendario ----------
function madridWall(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}

/** Instante UTC de una hora de pared en Madrid. */
function madridToUtc(y: number, m: number, d: number, h: number, mi: number) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const w = madridWall(new Date(guess));
  const offset = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi) - guess;
  return new Date(guess - offset);
}

/** Último turno programado de una tarea con hora fija, no posterior a `now`. */
function lastSlot(spec: Spec, now: Date): Date {
  const [h, mi] = (spec.at ?? "00:00").split(":").map(Number);
  const today = madridWall(now);
  for (let k = 0; k < 40; k++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d - k, 12));
    const weekday = (day.getUTCDay() + 6) % 7;
    if (spec.weekday != null && weekday !== spec.weekday) continue;
    if (spec.monthday != null && day.getUTCDate() !== spec.monthday) continue;
    const slot = madridToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h, mi);
    if (slot <= now) return slot;
  }
  return new Date(0);
}

function isDue(spec: Spec, last: Date | undefined, now: Date) {
  if (!last) return true;
  if (spec.every) return now.getTime() - last.getTime() >= spec.every * 60_000 - 30_000;
  return last < lastSlot(spec, now);
}

async function lastRuns() {
  const db = await connect();
  try {
    const { rows } = await db.query<{ job_name: string; last: Date }>(
      "select job_name, max(started_at) as last from public.job_runs where user_id = $1 and not details @> '{\"demo\": true}' group by job_name",
      [USER_ID()],
    );
    return new Map(rows.map((r) => [r.job_name, r.last]));
  } finally {
    await db.end();
  }
}

// ---------- Vigilancia ----------
async function watchdog(db: import("pg").Client) {
  const uid = USER_ID();
  const { rows } = await db.query<{ job_name: string; last_ok: Date | null }>(
    `select job_name, max(started_at) filter (where status in ('ok','skipped')) as last_ok
       from public.job_runs where user_id = $1 and not details @> '{"demo": true}' group by job_name`,
    [uid],
  );
  const lastOk = new Map(rows.map((r) => [r.job_name, r.last_ok]));
  const stale: string[] = [];
  for (const spec of JOBS) {
    if (!spec.staleAfter || !lastOk.has(spec.name)) continue; // nunca ejecutada: aún no hay referencia
    const ok = lastOk.get(spec.name);
    if (ok && Date.now() - ok.getTime() < spec.staleAfter * 60_000) continue;
    const title = `Sin ejecutarse bien: ${jobLabel(spec.name)}`;
    const dup = await db.query(
      "select 1 from public.notifications where user_id = $1 and title = $2 and created_at > now() - interval '24 hours'",
      [uid, title],
    );
    if (dup.rowCount) continue;
    await db.query(
      "insert into public.notifications (user_id, level, title, body, link) values ($1, 'warning', $2, $3, '/productividad')",
      [uid, title, ok ? `Última ejecución correcta: ${ok.toLocaleString("es-ES", { timeZone: TZ })}.` : "No ha terminado bien ninguna vez."],
    );
    stale.push(spec.name);
  }
  return { items: stale.length, details: { stale }, message: stale.length ? `Avisos: ${stale.join(", ")}` : "Todo al día" };
}

// ---------- Bucle ----------
let busy = false;
let stopping = false;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const last = await lastRuns();
    const now = new Date();
    for (const spec of JOBS) {
      if (stopping) break;
      if (isDue(spec, last.get(spec.name), now)) await runJob(spec.name, spec.fn);
    }
  } catch (e) {
    log(`planificador: ${(e as Error).message}`);
  } finally {
    busy = false;
  }
}

const args = process.argv.slice(2);
const runOne = args.find((a) => a.startsWith("--run="))?.split("=")[1];

if (runOne) {
  const spec = JOBS.find((j) => j.name === runOne);
  if (!spec) {
    console.error(`Tarea desconocida. Disponibles: ${JOBS.map((j) => j.name).join(", ")}`);
    process.exit(1);
  }
  const r = await runJob(spec.name, spec.fn);
  process.exitCode = r.ok ? 0 : 1;
} else if (args.includes("--once")) {
  await tick();
} else {
  log(`Worker iniciado (pid ${process.pid}). Tareas: ${JOBS.map((j) => j.name).join(", ")}`);
  const timer = setInterval(tick, 60_000);
  void tick();
  const shutdown = (signal: string) => {
    log(`${signal}: deteniendo${busy ? " al terminar la tarea en curso" : ""}`);
    stopping = true;
    clearInterval(timer);
    const wait = setInterval(() => { if (!busy) { clearInterval(wait); process.exit(0); } }, 500);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

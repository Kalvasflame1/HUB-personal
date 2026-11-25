import type pg from "pg";
import { connect, startJob, USER_ID } from "./db.ts";

export type JobResult = {
  status?: "ok" | "skipped";
  items?: number | null;
  details?: Record<string, unknown>;
  message?: string;
};

export type JobFn = (db: pg.Client) => Promise<JobResult>;

/** Error que no es un fallo (p. ej. límite de Strava): la ejecución queda como «skipped». */
export class SkipError extends Error {}

/**
 * Fallo temporal de un servicio externo (p. ej. Craft devuelve 502/504 desde Cloudflare).
 * Cuenta como error, pero solo genera aviso si se repite en dos ejecuciones seguidas.
 */
export class TransientError extends Error {}
const isTransient = (e: unknown) => e instanceof TransientError || /Craft no responde/.test((e as Error).message);

const LABEL: Record<string, string> = {
  strava_sync: "Sincronización de Strava",
  web_fetch: "Recogida de fuentes web",
  report_daily: "Informe diario",
  report_weekly: "Informe semanal",
  report_monthly: "Informe mensual",
  watchdog: "Vigilancia de tareas",
  craft_index: "Índice de Craft",
  backup: "Copia de seguridad",
  cleanup: "Limpieza",
  craft_extras: "Eventos y seguimiento de Craft",
  craft_changes: "Cambios del seguimiento en Craft",
  craft_next_tasks: "Tareas para mañana desde Craft",
  podcast: "Podcast diario",
  web_digest: "Resumen de fuentes web",
};
export const jobLabel = (name: string) => LABEL[name] ?? name;

/**
 * Ejecuta una tarea con su propia conexión y la registra en job_runs.
 * Si falla, crea un aviso, pero solo cuando la ejecución anterior no había fallado ya
 * (así un fallo persistente no genera un aviso cada 30 minutos). Los fallos temporales
 * (TransientError) solo avisan a partir del segundo seguido.
 */
export async function runJob(name: string, fn: JobFn): Promise<JobResult & { ok: boolean }> {
  const started = Date.now();
  let db: pg.Client | undefined;
  try {
    db = await connect();
    const finish = await startJob(db, name);
    try {
      const r = await fn(db);
      await finish(r.status ?? "ok", r.items ?? null, { ...r.details, ms: Date.now() - started });
      log(`${name}: ${r.status ?? "ok"}${r.message ? ` · ${r.message}` : ""}`);
      return { ...r, ok: true };
    } catch (e) {
      const message = (e as Error).message;
      const skipped = e instanceof SkipError || (e as Error).name === "RateLimitError";
      await finish(skipped ? "skipped" : "error", null, { ms: Date.now() - started }, message);
      if (!skipped) await notifyFailure(db, name, message, isTransient(e));
      log(`${name}: ${skipped ? "skipped" : "ERROR"} · ${message}`);
      return { ok: skipped, message };
    }
  } catch (e) {
    // Sin conexión con la base de datos: no se puede registrar nada.
    log(`${name}: sin conexión con Supabase · ${(e as Error).message}`);
    return { ok: false, message: (e as Error).message };
  } finally {
    await db?.end().catch(() => {});
  }
}

async function notifyFailure(db: pg.Client, name: string, message: string, transient = false) {
  // Las dos ejecuciones anteriores a esta (la actual ya está registrada como error)
  const prev = await db.query<{ status: string }>(
    `select status from public.job_runs
      where user_id = $1 and job_name = $2 and finished_at is not null
      order by started_at desc offset 1 limit 2`,
    [USER_ID(), name],
  );
  const [p1, p2] = prev.rows.map((r) => r.status);
  if (transient) {
    // Primer fallo temporal: sin aviso. Segundo seguido: aviso. Tercero y siguientes: ya avisado.
    if (p1 !== "error" || p2 === "error") return;
  } else if (p1 === "error") return;
  await db.query(
    "insert into public.notifications (user_id, level, title, body, link) values ($1, 'error', $2, $3, '/productividad')",
    [USER_ID(), `Ha fallado: ${jobLabel(name)}`, message.slice(0, 500)],
  );
}

export function log(message: string) {
  const ts = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Madrid" });
  console.log(`[${ts}] ${message}`);
}

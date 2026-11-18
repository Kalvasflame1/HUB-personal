/**
 * Limpieza semanal (domingos 04:00). Reglas autorizadas por el usuario el 18-11-2026:
 *
 * - web_items: lecturas de más de 90 días que no estén guardadas (is_saved).
 * - job_runs: historial de ejecuciones de más de 180 días.
 * - notifications: avisos leídos hace más de 90 días (los no leídos se quedan).
 * - activity_log: entradas del feed de más de 365 días.
 *
 * Nunca toca Strava, tareas, proyectos, informes ni el índice de Craft, ni datos de demostración.
 * Solo se ejecuta si hay una copia de seguridad correcta de las últimas 24 horas.
 *
 *   npm run cleanup --workspace apps/worker               borra
 *   npm run cleanup --workspace apps/worker -- --dry-run  solo cuenta lo que borraría
 */
import type pg from "pg";
import { USER_ID } from "./db.ts";
import { runJob, type JobResult } from "./jobs.ts";

const RULES = [
  { key: "web_items", label: "lecturas web", sql: "from public.web_items where user_id = $1 and not is_demo and not is_saved and fetched_at < now() - interval '90 days'" },
  { key: "job_runs", label: "ejecuciones", sql: "from public.job_runs where user_id = $1 and started_at < now() - interval '180 days'" },
  { key: "notifications", label: "avisos leídos", sql: "from public.notifications where user_id = $1 and read_at is not null and read_at < now() - interval '90 days'" },
  { key: "activity_log", label: "actividad", sql: "from public.activity_log where user_id = $1 and not is_demo and occurred_at < now() - interval '365 days'" },
] as const;

export async function cleanup(db: pg.Client, opts: { dryRun?: boolean } = {}): Promise<JobResult> {
  const uid = USER_ID();
  const backup = await db.query(
    "select 1 from public.job_runs where user_id = $1 and job_name = 'backup' and status = 'ok' and started_at > now() - interval '24 hours' limit 1",
    [uid],
  );
  if (!backup.rowCount) throw new Error("No hay una copia de seguridad correcta de las últimas 24 horas: no se borra nada");

  const counts: Record<string, number> = {};
  await db.query("begin");
  try {
    for (const r of RULES) {
      const res = opts.dryRun
        ? await db.query<{ n: string }>(`select count(*) n ${r.sql}`, [uid]).then((x) => Number(x.rows[0].n))
        : await db.query(`delete ${r.sql}`, [uid]).then((x) => x.rowCount ?? 0);
      counts[r.key] = res;
    }
    await db.query(opts.dryRun ? "rollback" : "commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const parts = RULES.filter((r) => counts[r.key]).map((r) => `${counts[r.key]} ${r.label}`);
  return {
    items: total,
    details: { ...counts, dryRun: !!opts.dryRun },
    message: `${opts.dryRun ? "Prueba (sin borrar): " : ""}${parts.length ? parts.join(", ") : "nada que borrar"}`,
  };
}

if (import.meta.main) {
  const dryRun = process.argv.includes("--dry-run");
  const r = await runJob("cleanup", (db) => cleanup(db, { dryRun }));
  if (!r.ok) process.exitCode = 1;
}

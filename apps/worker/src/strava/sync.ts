/**
 * Sincronización de Strava.
 *
 *   npm run strava:sync --workspace apps/worker                 incremental
 *   npm run strava:sync --workspace apps/worker -- --full       vuelve a leer todo el historial
 *   npm run strava:sync --workspace apps/worker -- --details=200  detalles por ejecución (por defecto 60)
 *   npm run strava:sync --workspace apps/worker -- --clear-demo   borra antes los datos de demostración de running
 *
 * 1. Lista de actividades (200 por petición): todas las de la cuenta, de cualquier deporte.
 * 2. Detalle de las carreras que aún no lo tienen (parciales y mejores esfuerzos), de la más reciente
 *    a la más antigua, hasta el tope por ejecución o hasta acercarse a los límites de Strava.
 *    Lo que quede se completa en las siguientes ejecuciones.
 * 3. Marcas personales recalculadas a partir de los mejores esfuerzos.
 */
import type pg from "pg";
import { connect, startJob, USER_ID } from "../db.ts";
import {
  getAccessToken, hasBudget, RateLimitError, stravaGet, usage,
  type DetailedActivity, type SummaryActivity,
} from "./api.ts";

const RUN_TYPES = ["Run", "TrailRun", "VirtualRun"];
const PR_KEYS: Record<string, string> = {
  "1K": "1k", "5K": "5k", "10K": "10k", "1k": "1k", "5k": "5k", "10k": "10k",
  "Half-Marathon": "half_marathon", "Marathon": "marathon",
};
const PR_LABEL: Record<string, string> = {
  "1k": "1 km", "5k": "5 km", "10k": "10 km", half_marathon: "media maratón", marathon: "maratón",
};

const args = process.argv.slice(2);
const FULL = args.includes("--full");
const CLEAR_DEMO = args.includes("--clear-demo");
const DETAILS = Number(args.find((a) => a.startsWith("--details="))?.split("=")[1] ?? 60);

const localTs = (s: string) => s.replace("Z", "").slice(0, 19); // Strava marca la hora local con Z
const round = (n: number | undefined | null, d = 1) => (n == null ? null : Number(n.toFixed(d)));
/** Strava devuelve a veces valores imposibles (p. ej. entradas manuales sin tiempo): se guardan vacíos. */
const sane = (n: number | undefined | null, max: number, d = 1) => (n == null || !Number.isFinite(n) || n < 0 || n > max ? null : round(n, d));
const mmss = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

async function clearDemo(db: pg.Client, uid: string) {
  await db.query("begin");
  const a = await db.query("delete from public.strava_activities where user_id = $1 and is_demo", [uid]);
  const p = await db.query("delete from public.personal_records where user_id = $1 and is_demo", [uid]);
  await db.query("delete from public.activity_log where user_id = $1 and is_demo and kind = 'run_imported'", [uid]);
  await db.query("delete from public.notifications where user_id = $1 and title like '[Demo] Nueva marca%'", [uid]);
  await db.query("commit");
  console.log(`Demo borrada: ${a.rowCount} actividades, ${p.rowCount} marcas.`);
}

async function upsertSummary(db: pg.Client, uid: string, a: SummaryActivity) {
  try {
    return await upsertSummaryRow(db, uid, a);
  } catch (e) {
    const { id, sport_type, start_date_local, distance, total_elevation_gain, average_speed, max_speed, average_cadence, average_heartrate } = a;
    throw new Error(`Actividad ${id}: ${(e as Error).message} ${JSON.stringify({ sport_type, start_date_local, distance, total_elevation_gain, average_speed, max_speed, average_cadence, average_heartrate })}`);
  }
}

async function upsertSummaryRow(db: pg.Client, uid: string, a: SummaryActivity) {
  const { rows } = await db.query<{ inserted: boolean }>(
    `insert into public.strava_activities
       (id, user_id, sport_type, name, start_date, start_date_local, distance_m, moving_time_s, elapsed_time_s,
        elevation_gain_m, average_speed_ms, max_speed_ms, average_heartrate, max_heartrate, average_cadence,
        suffer_score, gear_id, summary_polyline, raw, synced_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, now())
     on conflict (id) do update set
       sport_type = excluded.sport_type, name = excluded.name, start_date = excluded.start_date,
       start_date_local = excluded.start_date_local, distance_m = excluded.distance_m,
       moving_time_s = excluded.moving_time_s, elapsed_time_s = excluded.elapsed_time_s,
       elevation_gain_m = excluded.elevation_gain_m, average_speed_ms = excluded.average_speed_ms,
       max_speed_ms = excluded.max_speed_ms, average_heartrate = excluded.average_heartrate,
       max_heartrate = excluded.max_heartrate, average_cadence = excluded.average_cadence,
       suffer_score = excluded.suffer_score, gear_id = excluded.gear_id,
       summary_polyline = excluded.summary_polyline,
       raw = case when strava_activities.has_detail then strava_activities.raw else excluded.raw end,
       synced_at = now()
     where strava_activities.user_id = excluded.user_id
     returning (xmax = 0) as inserted`,
    [
      a.id, uid, a.sport_type, a.name, a.start_date, localTs(a.start_date_local),
      round(a.distance), a.moving_time, a.elapsed_time, sane(a.total_elevation_gain, 99_999),
      sane(a.average_speed, 100, 3), sane(a.max_speed, 100, 3), sane(a.average_heartrate, 250), sane(a.max_heartrate, 250),
      sane(a.average_cadence, 300), a.suffer_score ?? null, a.gear_id ?? null, a.map?.summary_polyline ?? null,
      JSON.stringify(a),
    ],
  );
  return rows[0]?.inserted ?? false;
}

async function saveDetail(db: pg.Client, uid: string, d: DetailedActivity) {
  await db.query("begin");
  try {
    await db.query(
      "update public.strava_activities set raw = $2, calories = $3, has_detail = true, synced_at = now() where id = $1",
      [d.id, JSON.stringify(d), sane(d.calories, 99_999)],
    );
    await db.query("delete from public.strava_laps where activity_id = $1", [d.id]);
    for (const l of d.laps ?? []) {
      await db.query(
        `insert into public.strava_laps (id, activity_id, user_id, lap_index, distance_m, moving_time_s, average_speed_ms, average_heartrate)
         values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing`,
        [l.id, d.id, uid, l.lap_index, round(l.distance), l.moving_time, sane(l.average_speed, 100, 3), sane(l.average_heartrate, 250)],
      );
    }
    await db.query("delete from public.strava_best_efforts where activity_id = $1", [d.id]);
    for (const e of d.best_efforts ?? []) {
      await db.query(
        `insert into public.strava_best_efforts (id, activity_id, user_id, name, distance_m, elapsed_time_s, moving_time_s, start_date, pr_rank)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
        [e.id, d.id, uid, e.name, round(e.distance), e.elapsed_time, e.moving_time ?? null, e.start_date, e.pr_rank ?? null],
      );
    }
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

/** Recalcula las marcas vigentes. Devuelve las que han mejorado respecto a las anteriores. */
async function refreshRecords(db: pg.Client, uid: string) {
  const before = await db.query<{ distance_key: string; time_s: number }>(
    "select distance_key, time_s from public.personal_records where user_id = $1 and is_current and not is_demo",
    [uid],
  );
  const prev = new Map(before.rows.map((r) => [r.distance_key, r.time_s]));

  const best = await db.query<{ name: string; elapsed_time_s: number; activity_id: string; start_date: Date }>(
    `select distinct on (name) name, elapsed_time_s, activity_id, start_date
       from public.strava_best_efforts
      where user_id = $1 and name = any($2)
      order by name, elapsed_time_s, start_date`,
    [uid, Object.keys(PR_KEYS)],
  );

  const improved: { key: string; time: number }[] = [];
  await db.query("begin");
  try {
  await db.query("delete from public.personal_records where user_id = $1 and not is_demo", [uid]);
  for (const b of best.rows) {
    const key = PR_KEYS[b.name];
    const r = await db.query(
      `insert into public.personal_records (user_id, distance_key, time_s, activity_id, achieved_at)
       values ($1,$2,$3,$4,$5)
       on conflict (user_id, distance_key) where is_current do nothing`,
      [uid, key, b.elapsed_time_s, b.activity_id, b.start_date],
    );
    const old = prev.get(key);
    if (r.rowCount && old != null && b.elapsed_time_s < old) improved.push({ key, time: b.elapsed_time_s });
  }
  await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
  return { count: best.rows.length, improved };
}

async function main() {
  const uid = USER_ID();
  const db = await connect();
  const finishJob = await startJob(db, "strava_sync");
  const stats = { listed: 0, inserted: 0, details: 0, pending_details: 0, records: 0, stopped_by_limit: false };

  try {
    if (CLEAR_DEMO) await clearDemo(db, uid);
    const token = await getAccessToken(db);

    // 1. Lista
    const last = await db.query<{ last: Date | null; n: string }>(
      "select max(start_date) as last, count(*) as n from public.strava_activities where user_id = $1 and not is_demo",
      [uid],
    );
    const firstImport = Number(last.rows[0].n) === 0;
    // Margen de 3 días para recoger ediciones recientes (nombre, tipo…)
    const after = FULL || !last.rows[0].last ? 0 : Math.floor(last.rows[0].last.getTime() / 1000) - 3 * 86400;
    const newRuns: SummaryActivity[] = [];

    for (let page = 1; ; page++) {
      if (!hasBudget()) { stats.stopped_by_limit = true; break; }
      const list = await stravaGet<SummaryActivity[]>(token, "/athlete/activities", { after, page, per_page: 200 });
      for (const a of list) {
        stats.listed++;
        if (await upsertSummary(db, uid, a)) {
          stats.inserted++;
          if (RUN_TYPES.includes(a.sport_type)) newRuns.push(a);
        }
      }
      process.stdout.write(`\rActividades leídas: ${stats.listed}`);
      if (list.length < 200) break;
    }
    console.log();

    // Entradas en la actividad reciente, solo para carreras nuevas en sincronizaciones normales
    if (!firstImport && !FULL) {
      for (const a of newRuns) {
        await db.query(
          `insert into public.activity_log (user_id, occurred_at, kind, title, entity_type, entity_id)
           values ($1, $2, 'run_imported', $3, 'strava_activity', $4)`,
          [uid, a.start_date, `${a.name} · ${(a.distance / 1000).toFixed(1).replace(".", ",")} km`, String(a.id)],
        );
      }
    }

    // 2. Detalles
    const pending = await db.query<{ id: string }>(
      `select id from public.strava_activities
        where user_id = $1 and not is_demo and not has_detail and sport_type = any($2)
        order by start_date desc`,
      [uid, RUN_TYPES],
    );
    for (const { id } of pending.rows.slice(0, DETAILS)) {
      if (!hasBudget()) { stats.stopped_by_limit = true; break; }
      const d = await stravaGet<DetailedActivity>(token, `/activities/${id}`, { include_all_efforts: "false" });
      await saveDetail(db, uid, d);
      stats.details++;
      process.stdout.write(`\rDetalles descargados: ${stats.details}`);
    }
    if (stats.details) console.log();
    stats.pending_details = pending.rows.length - stats.details;

    // 3. Marcas
    const rec = await refreshRecords(db, uid);
    stats.records = rec.count;
    for (const r of rec.improved) {
      await db.query(
        "insert into public.notifications (user_id, level, title, body, link) values ($1, 'success', $2, $3, '/running')",
        [uid, `Nueva marca en ${PR_LABEL[r.key]}`, mmss(r.time)],
      );
    }

    await finishJob("ok", stats.inserted, { ...stats, usage });
    console.log(
      `Listo: ${stats.listed} leídas, ${stats.inserted} nuevas, ${stats.details} detalles, ` +
      `${stats.pending_details} detalles pendientes, ${stats.records} marcas. ` +
      `Uso de Strava: ${usage.short}/${usage.shortLimit} (15 min), ${usage.daily}/${usage.dailyLimit} (día).`,
    );
    if (stats.stopped_by_limit) console.log("Parado por los límites de Strava: vuelve a ejecutarlo en 15 minutos.");
  } catch (e) {
    const limit = e instanceof RateLimitError;
    await finishJob(limit ? "skipped" : "error", stats.inserted, { ...stats, usage }, (e as Error).message);
    console.error(`\n${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

await main();

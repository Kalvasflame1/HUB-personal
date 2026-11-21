/**
 * Podcast diario: convierte el guion del «Resumen diario» en un episodio de la app.
 *
 * 1. Lanza el atajo del Mac «HUB - Podcast», que lee podcast_hoy.txt (lo deja Cowork en iCloud)
 *    y devuelve el audio con la voz de Siri. El worker no entra en iCloud: se lo pide a Atajos.
 * 2. Si el audio es el mismo que el del último episodio (Cowork aún no ha dejado guion nuevo),
 *    se omite y se reintenta en la siguiente vuelta, hasta las 13:00.
 * 3. Lo convierte a AAC mono de 64 kbps con afconvert (≈ 77 MB → 3,4 MB), lo sube al bucket
 *    privado «podcast» como <user_id>/AAAA-MM-DD.m4a y registra la fila en podcast_episodes.
 * 4. Conserva los 7 episodios más recientes.
 *
 *   npm run podcast --workspace apps/worker            como lo haría el planificador
 *   npm run podcast --workspace apps/worker -- --force aunque ya exista el de hoy
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type pg from "pg";
import { env, USER_ID } from "./db.ts";
import { runJob, SkipError, type JobResult } from "./jobs.ts";

const run = promisify(execFile);
const SHORTCUT = "HUB - Podcast";
const DIR = join(homedir(), "Library/Application Support/PersonalHub/podcast");
const STATE = join(DIR, "last.json");
const KEEP = 7;
const FROM = "06:30";
const UNTIL = "13:00";
const TZ = "Europe/Madrid";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function madridNow() {
  const date = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
  const time = new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return { date, time };
}

function storageUrl() {
  if (process.env.SUPABASE_URL?.trim()) return process.env.SUPABASE_URL.trim().replace(/\/$/, "");
  // postgresql://postgres.<ref>:…@… → https://<ref>.supabase.co
  const ref = env("SUPABASE_DB_URL").match(/postgres\.([a-z0-9]+):/)?.[1];
  if (!ref) throw new Error("No se puede deducir SUPABASE_URL; añádela a apps/worker/.env");
  return `https://${ref}.supabase.co`;
}

async function storage(method: string, path: string, body?: Uint8Array | string, type = "application/json") {
  const key = env("SUPABASE_SECRET_KEY");
  const res = await fetch(`${storageUrl()}/storage/v1/${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": type, "x-upsert": "true" },
    body: typeof body === "string" ? body : body ? new Blob([new Uint8Array(body)]) : undefined,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Storage ${method} ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

async function durationOf(file: string) {
  const { stdout } = await run("/usr/bin/afinfo", [file]);
  const s = Number(stdout.match(/estimated duration:\s*([\d.]+)/)?.[1]);
  return Number.isFinite(s) ? Math.round(s) : null;
}

type LastState = { hash: string; duration: number | null; date: string };

export async function podcast(db: pg.Client, opts: { force?: boolean } = {}): Promise<JobResult> {
  const uid = USER_ID();
  const { date, time } = madridNow();
  if (!opts.force && (time < FROM || time >= UNTIL)) throw new SkipError(`fuera de horario (${FROM}–${UNTIL})`);

  const { rows: existing } = await db.query("select 1 from public.podcast_episodes where user_id = $1 and episode_date = $2", [uid, date]);
  if (existing.length && !opts.force) throw new SkipError("el episodio de hoy ya está subido");

  await mkdir(DIR, { recursive: true });
  const raw = join(DIR, "hoy.caf");
  const m4a = join(DIR, `${date}.m4a`);
  await rm(raw, { force: true });

  // 1. Atajo (voz de Siri). Unos 45 s para 7 min de audio
  try {
    await run("/usr/bin/shortcuts", ["run", SHORTCUT, "--output-path", raw], { timeout: 5 * 60_000 });
  } catch (e) {
    const err = e as Error & { stderr?: string; killed?: boolean; code?: number };
    throw new Error(`El atajo «${SHORTCUT}» falló${err.killed ? " (tiempo agotado)" : ""}: ${(err.stderr || err.message).trim().slice(0, 300)}`);
  }
  const rawSize = (await stat(raw)).size;
  if (rawSize < 10_000) throw new Error(`El atajo devolvió un audio vacío (${rawSize} bytes)`);

  // 2. ¿Guion nuevo?
  const hash = createHash("sha256").update(await readFile(raw)).digest("hex");
  const duration = await durationOf(raw);
  const last = JSON.parse(await readFile(STATE, "utf8").catch(() => "null")) as LastState | null;
  const same = last && last.date !== date && (last.hash === hash || (duration != null && last.duration === duration));
  if (same && !opts.force) {
    await rm(raw, { force: true });
    throw new SkipError(`el guion parece el mismo que el del ${last.date}; se reintenta más tarde`);
  }

  // 3. AAC y subida
  await run("/usr/bin/afconvert", ["-f", "m4af", "-d", "aac", "-b", "64000", "-c", "1", raw, m4a], { timeout: 5 * 60_000 });
  const audio = await readFile(m4a);
  const path = `${uid}/${date}.m4a`;
  await storage("POST", `object/podcast/${path}`, audio, "audio/mp4");

  const [y, mo, d] = date.split("-").map(Number);
  const weekday = DAYS[new Date(Date.UTC(y, mo - 1, d, 12)).getUTCDay()];
  const title = `Resumen diario · ${weekday} ${d} de ${MONTHS[mo - 1]}`;
  await db.query(
    `insert into public.podcast_episodes (user_id, episode_date, title, storage_path, duration_s, bytes, voice)
     values ($1, $2, $3, $4, $5, $6, 'siri')
     on conflict (user_id, episode_date) do update set title = excluded.title, storage_path = excluded.storage_path,
       duration_s = excluded.duration_s, bytes = excluded.bytes, voice = excluded.voice, created_at = now()`,
    [uid, date, title, path, duration, audio.length],
  );
  await writeFile(STATE, JSON.stringify({ hash, duration, date } satisfies LastState));

  // 4. Conservar los 7 más recientes (bucket y tabla)
  const { rows: old } = await db.query<{ id: string; storage_path: string }>(
    "select id, storage_path from public.podcast_episodes where user_id = $1 order by episode_date desc offset $2",
    [uid, KEEP],
  );
  if (old.length) {
    await storage("DELETE", "object/podcast", JSON.stringify({ prefixes: old.map((o) => o.storage_path) }));
    await db.query("delete from public.podcast_episodes where id = any($1)", [old.map((o) => o.id)]);
  }
  await rm(raw, { force: true });
  await rm(m4a, { force: true });

  const mb = (audio.length / 1_048_576).toLocaleString("es-ES", { maximumFractionDigits: 1 });
  const min = duration ? `${Math.floor(duration / 60)} min ${duration % 60} s` : "duración desconocida";
  return { items: 1, details: { date, duration, bytes: audio.length, removed: old.length }, message: `${title} · ${min} · ${mb} MB` };
}

if (import.meta.main) {
  const force = process.argv.includes("--force");
  const r = await runJob("podcast", (db) => podcast(db, { force }));
  process.exit(r.ok ? 0 : 1);
}

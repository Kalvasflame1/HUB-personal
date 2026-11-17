import type pg from "pg";
import { env, USER_ID } from "../db.ts";
import { SkipError } from "../jobs.ts";

const API = "https://www.strava.com/api/v3";
const TOKEN_URL = "https://www.strava.com/oauth/token";

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // segundos desde 1970
  athlete?: { id: number; firstname?: string };
};

export type SummaryActivity = {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain?: number;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  suffer_score?: number | null;
  calories?: number;
  gear_id?: string | null;
  map?: { summary_polyline?: string | null };
};

export type Lap = {
  id: number;
  lap_index: number;
  distance: number;
  moving_time: number;
  average_speed?: number;
  average_heartrate?: number;
};

export type BestEffort = {
  id: number;
  name: string;
  distance: number;
  elapsed_time: number;
  moving_time?: number;
  start_date: string;
  pr_rank?: number | null;
};

export type DetailedActivity = SummaryActivity & { laps?: Lap[]; best_efforts?: BestEffort[] };

/** Uso de los límites de lectura que Strava devuelve en cada respuesta. */
export const usage = { short: 0, shortLimit: 100, daily: 0, dailyLimit: 1000 };

export class RateLimitError extends SkipError {}

function readUsage(res: Response) {
  const limit = res.headers.get("x-readratelimit-limit") ?? res.headers.get("x-ratelimit-limit");
  const used = res.headers.get("x-readratelimit-usage") ?? res.headers.get("x-ratelimit-usage");
  if (limit && used) {
    const [sl, dl] = limit.split(",").map(Number);
    const [su, du] = used.split(",").map(Number);
    Object.assign(usage, { short: su, shortLimit: sl, daily: du, dailyLimit: dl });
  }
}

/** true si queda margen para otra petición sin rozar los límites. */
export function hasBudget(reserve = 5) {
  return usage.short < usage.shortLimit - reserve && usage.daily < usage.dailyLimit - reserve * 4;
}

export async function exchangeToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("STRAVA_CLIENT_ID"),
      client_secret: env("STRAVA_CLIENT_SECRET"),
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Strava rechazó el token (${res.status}): ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

/** Devuelve un token de acceso válido, renovándolo si caduca en menos de 5 minutos. */
export async function getAccessToken(db: pg.Client): Promise<string> {
  const { rows } = await db.query<{ access_token: string; refresh_token: string; expires_at: Date }>(
    "select access_token, refresh_token, expires_at from private.strava_tokens where user_id = $1",
    [USER_ID()],
  );
  if (!rows[0]) throw new Error("No hay tokens de Strava. Ejecuta antes: npm run strava:auth --workspace apps/worker");
  const t = rows[0];
  if (t.expires_at.getTime() - Date.now() > 5 * 60_000) return t.access_token;

  const fresh = await exchangeToken({ grant_type: "refresh_token", refresh_token: t.refresh_token });
  await db.query(
    `update private.strava_tokens
        set access_token = $2, refresh_token = $3, expires_at = to_timestamp($4), updated_at = now()
      where user_id = $1`,
    [USER_ID(), fresh.access_token, fresh.refresh_token, fresh.expires_at],
  );
  return fresh.access_token;
}

export async function stravaGet<T>(token: string, path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  readUsage(res);
  if (res.status === 429) throw new RateLimitError("Límite de peticiones de Strava alcanzado");
  if (!res.ok) throw new Error(`Strava ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

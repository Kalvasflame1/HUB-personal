import type { getSession } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { WARMUP_DAYS, fitnessSeries } from "@/lib/fitness";

type Client = Awaited<ReturnType<typeof getSession>>["supabase"];

function shiftISO(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Serie diaria de forma, fatiga y frescura de los últimos `days` días, hasta hoy.
 * Usa la carga de todas las actividades (no solo carreras): la forma es del cuerpo entero.
 */
export async function loadFitness(supabase: Client, days = 365) {
  const today = todayISO();
  const from = shiftISO(today, -days);
  const { data } = await supabase
    .from("strava_activities")
    .select("start_date_local,suffer_score")
    .not("suffer_score", "is", null)
    .gte("start_date_local", shiftISO(from, -WARMUP_DAYS))
    .order("start_date_local")
    .limit(3000);
  const series = fitnessSeries((data ?? []).map((a) => ({ day: a.start_date_local, load: Number(a.suffer_score) })), from, today);
  return series.some((d) => d.load > 0) ? series : [];
}

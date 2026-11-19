/**
 * Forma, fatiga y frescura (modelo de rendimiento de Banister / PMC) a partir de la carga
 * diaria de Strava («esfuerzo relativo», `suffer_score`).
 *
 * - Forma (CTL): media móvil exponencial de la carga diaria con constante de 42 días.
 * - Fatiga (ATL): lo mismo con constante de 7 días.
 * - Frescura (TSB): forma menos fatiga. Positiva = descansado; muy negativa = sobrecarga.
 *
 * Se calcula con un periodo previo de calentamiento para que la forma del primer día
 * mostrado no parta de cero.
 */

export const CTL_DAYS = 42;
export const ATL_DAYS = 7;
/** Días previos que se leen solo para estabilizar las medias (≈ 4 constantes de forma). */
export const WARMUP_DAYS = 180;

export type FitnessPoint = { date: string; ctl: number; atl: number; tsb: number; load: number };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * @param activities fecha local (AAAA-MM-DD…) y carga de cada actividad
 * @param from primer día devuelto
 * @param to último día devuelto (hoy)
 */
export function fitnessSeries(activities: { day: string; load: number }[], from: string, to: string): FitnessPoint[] {
  const daily = new Map<string, number>();
  for (const a of activities) {
    const day = a.day.slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + a.load);
  }

  const start = addDays(from, -WARMUP_DAYS);
  const out: FitnessPoint[] = [];
  let ctl = 0;
  let atl = 0;
  for (let day = start; day <= to; day = addDays(day, 1)) {
    const load = daily.get(day) ?? 0;
    ctl += (load - ctl) / CTL_DAYS;
    atl += (load - atl) / ATL_DAYS;
    if (day >= from) out.push({ date: day, ctl: round1(ctl), atl: round1(atl), tsb: round1(ctl - atl), load });
  }
  return out;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function freshnessText(tsb: number) {
  if (tsb > 15) return "Muy descansado: la forma puede empezar a bajar";
  if (tsb > 5) return "Fresco: buen momento para competir o apretar";
  if (tsb >= -10) return "Equilibrado: entrenando sin acumular fatiga";
  if (tsb >= -30) return "Cargado: zona productiva, vigila la recuperación";
  return "Sobrecarga: conviene descansar";
}

/**
 * Preparación del día (0–100 %) a partir de la frescura: −30 o menos = 0 %, 0 = 67 %,
 * +15 o más = 100 %. Es una escala lineal y orientativa, no una medida fisiológica.
 */
export function readiness(tsb: number) {
  return Math.round(Math.min(100, Math.max(0, ((tsb + 30) / 45) * 100)));
}

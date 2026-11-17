const TZ = "Europe/Madrid";
const LOCALE = "es-ES";

export function km(meters: number | null | undefined, digits = 1) {
  return ((meters ?? 0) / 1000).toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function num(value: number | null | undefined, digits = 0) {
  return (value ?? 0).toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Segundos por km -> "5:12" */
export function pace(secPerKm: number | null | undefined) {
  if (!secPerKm || !isFinite(secPerKm)) return "–";
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function duration(seconds: number | null | undefined) {
  const s = Math.round(seconds ?? 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

export function dateShort(value: string | Date) {
  return new Date(value).toLocaleDateString(LOCALE, { day: "numeric", month: "short", timeZone: TZ });
}

export function dateLong(value: string | Date) {
  return new Date(value).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
}

/** Fecha de calendario "YYYY-MM-DD" (sin hora) -> "12 nov" */
export function dayShort(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Hoy en Madrid como "YYYY-MM-DD" */
export function todayISO() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function relative(value: string | Date) {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return dateShort(value);
}

export function greeting() {
  const hour = Number(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }).slice(0, 2));
  if (hour < 6) return "Buenas noches";
  if (hour < 13) return "Buenos días";
  if (hour < 21) return "Buenas tardes";
  return "Buenas noches";
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Lunes de la semana actual en Madrid como "YYYY-MM-DD" */
export function weekStartISO(offsetWeeks = 0) {
  const [y, m, d] = todayISO().split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dow + offsetWeeks * 7);
  return date.toISOString().slice(0, 10);
}

export function monthStartISO(offsetMonths = 0) {
  const [y, m] = todayISO().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offsetMonths, 1, 12)).toISOString().slice(0, 10);
}

export function monthName(isoDate: string) {
  const [y, m] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 12)).toLocaleDateString("es-ES", { month: "long", timeZone: "UTC" });
}

/** Instante de hace `days` días, en ISO (para filtros de consulta). */
export function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

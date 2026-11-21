/** Estados de la tabla «Seguimiento» de Craft, tal como están escritos allí (con su emoji). */
export const TRACKING_STATUSES = ["🔴 Abierto", "🟡 En curso", "🔵 Seguimiento", "🟢 Hecho", "⚫ Caducado"] as const;

export const STATUS_KEY: Record<string, string> = {
  "🔴 Abierto": "open",
  "🟡 En curso": "in_progress",
  "🔵 Seguimiento": "watching",
  "🟢 Hecho": "done",
  "⚫ Caducado": "expired",
};

/** La interfaz no usa emojis: «🟡 En curso» → «En curso». */
export const statusLabel = (s: string | null) => (s ?? "").replace(/^[^\p{L}]+/u, "").trim();

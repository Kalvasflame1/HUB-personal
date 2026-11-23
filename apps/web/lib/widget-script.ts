/**
 * Script de Scriptable (iPhone) para el widget del Hub. Se muestra en Más → Widget y Apple Watch
 * para copiarlo. La URL de Supabase y la clave publicable son públicas; la clave del widget no va
 * en el script: Scriptable la pide la primera vez y la guarda en el Llavero del iPhone.
 *
 * Tamaños: pequeño y mediano en la pantalla de inicio; rectangular, circular y en línea en la
 * pantalla de bloqueo. Si no hay red, enseña el último resumen guardado.
 */
export function widgetScript({ supabaseUrl, publishableKey, appUrl }: { supabaseUrl: string; publishableKey: string; appUrl: string }) {
  return `// Personal Hub · widget (Scriptable)
// Pega este script en Scriptable, ejecútalo una vez para guardar la clave y añade el widget.
const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
const PUBLISHABLE_KEY = ${JSON.stringify(publishableKey)};
const APP_URL = ${JSON.stringify(appUrl)};
const KEY_NAME = "personal_hub_widget_token";
const ACCENT = Color.dynamic(new Color("#0a6cff"), new Color("#3b8eff"));
const INK = Color.dynamic(new Color("#18181b"), new Color("#f4f4f5"));
const INK2 = Color.dynamic(new Color("#52525b"), new Color("#a1a1aa"));
const BG = Color.dynamic(new Color("#ffffff"), new Color("#131316"));

async function askToken() {
  const a = new Alert();
  a.title = "Clave del widget";
  a.message = "Pégala desde Más → Widget y Apple Watch en el Hub.";
  a.addSecureTextField("hubw_…", "");
  a.addAction("Guardar");
  a.addCancelAction("Cancelar");
  if ((await a.present()) === -1) return null;
  const t = a.textFieldValue(0).trim();
  if (t) Keychain.set(KEY_NAME, t);
  return t || null;
}

async function load(token) {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.cacheDirectory(), "personal-hub-widget.json");
  try {
    const req = new Request(SUPABASE_URL + "/rest/v1/rpc/widget_summary");
    req.method = "POST";
    req.headers = { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" };
    req.body = JSON.stringify({ token });
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    if (req.response.statusCode !== 200) return { error: data.message || "Error " + req.response.statusCode };
    fm.writeString(cache, JSON.stringify(data));
    return { data };
  } catch (e) {
    if (fm.fileExists(cache)) return { data: JSON.parse(fm.readString(cache)), stale: true };
    return { error: "Sin conexión" };
  }
}

const km = (n) => String(n).replace(/\\.0$/, "").replace(".", ",");
const pace = (s) => s ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " /km" : "";

function text(stack, value, size, color = INK, weight = "regular") {
  const t = stack.addText(value);
  t.font = weight === "bold" ? Font.boldSystemFont(size) : weight === "semibold" ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

function build(res) {
  const w = new ListWidget();
  w.url = APP_URL;
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  const family = config.widgetFamily || "medium";
  const lock = family.startsWith("accessory");
  if (!lock) { w.backgroundColor = BG; w.setPadding(14, 14, 14, 14); }

  if (res.error) {
    text(w, lock ? "Hub" : "Personal Hub", 13, ACCENT, "semibold");
    const e = text(w, res.error, 12, INK2);
    e.lineLimit = 3;
    return w;
  }
  const d = res.data, r = d.running, t = d.tasks;
  const today = (d.events[0] && d.events[0].date === d.date) ? d.events[0].items : [];

  if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
    text(s, r.readiness + "%", 16, Color.white(), "bold").centerAlignText();
    text(s, km(r.week_km) + " km", 10, Color.white()).centerAlignText();
    return w;
  }
  if (family === "accessoryInline") {
    text(w, r.readiness + "% · " + km(r.week_km) + " km · " + t.pending + " tareas", 12);
    return w;
  }
  if (family === "accessoryRectangular") {
    text(w, "Preparación " + r.readiness + "% · " + km(r.week_km) + " km", 13, Color.white(), "semibold");
    text(w, t.pending + " tareas · " + d.tracking.due_soon + " en 7 días", 12, Color.white());
    if (today.length) text(w, today.join(", "), 12, Color.white());
    return w;
  }

  // Pantalla de inicio
  const head = w.addStack(); head.centerAlignContent();
  text(head, "Personal Hub", 12, ACCENT, "semibold");
  head.addSpacer();
  if (res.stale) text(head, "sin red", 10, INK2);
  w.addSpacer(6);

  const row = w.addStack();
  const left = row.addStack(); left.layoutVertically();
  text(left, r.readiness + "%", 30, INK, "bold");
  text(left, "preparación", 11, INK2);
  w.addSpacer(4);
  if (family === "small") {
    w.addSpacer(2);
    text(w, km(r.week_km) + " km esta semana", 12, INK, "semibold");
    text(w, t.pending + " tareas · " + d.tracking.due_soon + " seguimiento", 12, INK2);
    if (d.podcast && d.podcast.today) text(w, "Podcast de hoy listo", 12, ACCENT);
    return w;
  }

  row.addSpacer(16);
  const right = row.addStack(); right.layoutVertically();
  text(right, km(r.week_km) + " km esta semana · " + km(r.month_km) + " este mes", 12, INK, "semibold");
  if (r.last) text(right, "Último: " + km(r.last.km) + " km · " + pace(r.last.pace_s_km), 12, INK2);
  text(right, t.pending + " tareas" + (t.overdue ? " (" + t.overdue + " atrasadas)" : "") + " · " + d.tracking.due_soon + " seguimiento en 7 días", 12, INK2);
  if (d.podcast && d.podcast.today) text(right, "Podcast de hoy listo", 12, ACCENT);
  w.addSpacer();
  if (today.length) {
    const ev = text(w, "Hoy: " + today.join(", "), 12, INK);
    ev.lineLimit = 2;
  } else if (d.tracking.next) {
    text(w, "Próximo: " + d.tracking.next.title, 12, INK);
  }
  return w;
}

let token = Keychain.contains(KEY_NAME) ? Keychain.get(KEY_NAME) : null;
if (!token && config.runsInApp) token = await askToken();
const res = token ? await load(token) : { error: "Abre el script en Scriptable y pega la clave del widget." };
if (res.error === "Clave no válida" && config.runsInApp) { Keychain.remove(KEY_NAME); }
const widget = build(res);
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
`;
}

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
const CARD = Color.dynamic(new Color("#f0f0f2"), new Color("#1c1c20"));
const TRACK = Color.dynamic(new Color("#e4e4e7"), new Color("#2c2c31"));
const GOOD = Color.dynamic(new Color("#1f8a4c"), new Color("#34c36b"));
const WARN = Color.dynamic(new Color("#b45309"), new Color("#f0a23b"));
const BAD = Color.dynamic(new Color("#c62828"), new Color("#ff6b61"));
const readyColor = (p) => p >= 60 ? GOOD : p >= 35 ? WARN : BAD;
function freshness(tsb) {
  if (tsb > 15) return "Muy descansado";
  if (tsb > 5) return "Fresco";
  if (tsb >= -10) return "Equilibrado";
  if (tsb >= -30) return "Cargado";
  return "Sobrecarga";
}
const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function shortDate(iso) {
  const d = new Date(iso + "T12:00:00");
  return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
}

function text(stack, value, size, color = INK, weight = "regular") {
  const t = stack.addText(String(value));
  t.font = weight === "bold" ? Font.boldRoundedSystemFont(size) : weight === "semibold" ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

/** Barra de preparación hecha con dos pilas (respeta modo claro y oscuro). */
function bar(parent, width, pct, height = 8) {
  const track = parent.addStack();
  track.size = new Size(width, height);
  track.backgroundColor = TRACK;
  track.cornerRadius = height / 2;
  const fill = track.addStack();
  fill.size = new Size(Math.max(height, Math.round(width * pct / 100)), height);
  fill.backgroundColor = readyColor(pct);
  fill.cornerRadius = height / 2;
  track.addSpacer();
}

function card(parent, w, h, label, value, sub, valueColor = INK) {
  const c = parent.addStack();
  c.layoutVertically();
  c.size = new Size(w, h);
  c.backgroundColor = CARD;
  c.cornerRadius = 14;
  c.setPadding(9, 11, 9, 11);
  text(c, label.toUpperCase(), 10, INK2, "semibold");
  c.addSpacer(3);
  text(c, value, 21, valueColor, "bold");
  if (sub) { c.addSpacer(1); text(c, sub, 11, INK2); }
  c.addSpacer();
  return c;
}

function header(w, d, size) {
  const head = w.addStack(); head.centerAlignContent();
  text(head, "Personal Hub", size, ACCENT, "bold");
  head.addSpacer();
  text(head, shortDate(d.date), size - 4, INK2, "semibold");
}

function build(res) {
  const w = new ListWidget();
  w.url = APP_URL;
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  const family = config.widgetFamily || "large";
  const lock = family.startsWith("accessory");
  if (!lock) { w.backgroundColor = BG; w.setPadding(16, 16, 16, 16); }

  if (res.error) {
    text(w, lock ? "Hub" : "Personal Hub", 16, ACCENT, "bold");
    const e = text(w, res.error, 13, INK2);
    e.lineLimit = 3;
    return w;
  }
  const d = res.data, r = d.running, t = d.tasks, tr = d.tracking;
  const today = (d.events[0] && d.events[0].date === d.date) ? d.events[0].items : [];
  const podcast = d.podcast && d.podcast.today;

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
    text(w, t.pending + " tareas · " + tr.due_soon + " en 7 días", 12, Color.white());
    if (today.length) text(w, today.join(", "), 12, Color.white());
    return w;
  }

  // Ancho útil aproximado del widget según la pantalla (inicio).
  const sw = Device.screenSize().width;
  const full = Math.round(sw * 0.85) - 32;
  const small = Math.round(sw * 0.4) - 32;

  if (family === "small") {
    text(w, "Personal Hub", 14, ACCENT, "bold");
    w.addSpacer(6);
    text(w, r.readiness + "%", 34, INK, "bold");
    text(w, "preparación · " + freshness(r.tsb).toLowerCase(), 11, INK2);
    w.addSpacer(6);
    bar(w, small, r.readiness);
    w.addSpacer();
    text(w, km(r.week_km) + " km esta semana", 13, INK, "semibold");
    text(w, t.pending + " tareas · " + tr.due_soon + " seguimiento", 12, INK2);
    return w;
  }

  if (family === "medium") {
    header(w, d, 17);
    w.addSpacer(8);
    const row = w.addStack(); row.centerAlignContent();
    text(row, r.readiness + "%", 24, INK, "bold");
    row.addSpacer(8);
    const col = row.addStack(); col.layoutVertically();
    text(col, "Preparación · " + freshness(r.tsb) + (podcast ? " · podcast listo" : ""), 11, INK2, "semibold");
    col.addSpacer(4);
    bar(col, full - 80, r.readiness, 7);
    w.addSpacer(10);
    const cards = w.addStack();
    const cw = Math.floor((full - 16) / 3);
    card(cards, cw, 62, "Semana", km(r.week_km) + " km", km(r.month_km) + " este mes");
    cards.addSpacer(8);
    card(cards, cw, 62, "Tareas", t.pending, t.overdue ? t.overdue + " atrasadas" : "pendientes", t.overdue ? BAD : INK);
    cards.addSpacer(8);
    card(cards, cw, 62, "Seguimiento", tr.due_soon, "en 7 días", tr.due_soon ? WARN : INK);
    return w;
  }

  // Grande
  header(w, d, 20);
  w.addSpacer(12);
  const ready = w.addStack(); ready.centerAlignContent();
  text(ready, r.readiness + "%", 38, INK, "bold");
  ready.addSpacer(10);
  const info = ready.addStack(); info.layoutVertically();
  text(info, "Preparación de hoy", 14, INK, "semibold");
  text(info, freshness(r.tsb) + " · frescura " + String(r.tsb).replace(".", ","), 12, INK2);
  w.addSpacer(8);
  bar(w, full, r.readiness, 10);
  w.addSpacer(12);

  const cw = Math.floor((full - 10) / 2);
  const g1 = w.addStack();
  card(g1, cw, 72, "Esta semana", km(r.week_km) + " km", km(r.month_km) + " km este mes");
  g1.addSpacer(10);
  card(g1, cw, 72, "Último rodaje", r.last ? km(r.last.km) + " km" : "—", r.last ? pace(r.last.pace_s_km) + " · " + shortDate(r.last.date) : "");
  w.addSpacer(10);
  const g2 = w.addStack();
  card(g2, cw, 72, "Tareas", t.pending, t.overdue ? t.overdue + " atrasadas" : t.today ? t.today + " para hoy" : "pendientes", t.overdue ? BAD : INK);
  g2.addSpacer(10);
  card(g2, cw, 72, "Seguimiento", tr.due_soon + " en 7 días", tr.next ? tr.next.title : tr.active + " activos", tr.due_soon ? WARN : INK);
  w.addSpacer(10);

  const hoy = w.addStack();
  hoy.layoutVertically();
  hoy.size = new Size(full, 0);
  hoy.backgroundColor = CARD;
  hoy.cornerRadius = 14;
  hoy.setPadding(9, 11, 9, 11);
  const hh = hoy.addStack(); hh.centerAlignContent();
  text(hh, "HOY", 10, INK2, "semibold");
  hh.addSpacer();
  if (podcast) text(hh, "Podcast listo", 11, ACCENT, "semibold");
  hoy.addSpacer(3);
  const ev = text(hoy, today.length ? today.join(" · ") : "Sin eventos en el informe de hoy", 14, INK);
  ev.lineLimit = 2;
  w.addSpacer();
  return w;
}

let token = Keychain.contains(KEY_NAME) ? Keychain.get(KEY_NAME) : null;
if (!token && config.runsInApp) token = await askToken();
const res = token ? await load(token) : { error: "Abre el script en Scriptable y pega la clave del widget." };
if (res.error === "Clave no válida" && config.runsInApp) { Keychain.remove(KEY_NAME); }
const widget = build(res);
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
`;
}

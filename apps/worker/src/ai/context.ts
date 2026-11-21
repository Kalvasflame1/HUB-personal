/**
 * F5-5 · Contexto del asistente, reunido con consultas de solo lectura.
 *
 * Claude no tiene herramientas: todo lo que sabe del Hub es lo que se arma aquí, según las
 * fuentes activadas en la configuración del asistente. Cada bloque lleva un número [n] que la
 * respuesta cita, y se guarda con su enlace para mostrarlo como fuente en la web.
 */
import type pg from "pg";

export type Source = { n: number; label: string; href?: string };
export type Settings = {
  instructions: string;
  style: string;
  sources: Record<string, boolean>;
  model_quick: string;
  daily_cap: number;
};

const DEFAULTS: Settings = {
  instructions: "",
  style: "normal",
  sources: { tasks: true, running: true, reports: true, web: true, craft: true, craft_personal: true },
  model_quick: "haiku",
  daily_cap: 20,
};

const MEMORY_ID = "f1422cc7-82fa-9911-d31b-637c6f868433"; // 🧠 Memoria e Información Importante
const TZ = "Europe/Madrid";

export async function loadSettings(db: pg.Client, uid: string): Promise<Settings> {
  const { rows } = await db.query(
    "select instructions, style, sources, model_quick, daily_cap from public.assistant_settings where user_id = $1 order by version desc limit 1",
    [uid],
  );
  if (!rows[0]) return DEFAULTS;
  return { ...DEFAULTS, ...rows[0], sources: { ...DEFAULTS.sources, ...rows[0].sources } };
}

const km = (m: number) => (m / 1000).toFixed(1).replace(".", ",");
const pace = (ms: number) => {
  if (!ms) return "—";
  const s = Math.round(1000 / ms);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
};
const hms = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
};
const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+\n/g, "\n").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

/** Palabras con contenido de la pregunta, para buscar en Craft. */
function terms(question: string) {
  const stop = new Set(["que", "con", "los", "las", "del", "una", "uno", "unos", "hay", "mis", "por", "más", "mas", "muy", "son", "fue", "ser", "eso", "esa", "ese", "hoy", "ayer", "como", "cómo", "cuando", "cuándo", "donde", "dónde", "tengo", "tiene", "para", "sobre", "esta", "este", "estos", "estas", "que", "qué", "cual", "cuál", "cuanto", "cuánto", "cuantos", "cuántos", "hacer", "puedo", "debo", "dime", "algo", "entre", "desde", "hasta", "mucho", "poco", "mejor", "peor"]);
  return [...new Set(question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])].filter((w) => !stop.has(w)).slice(0, 8);
}

export async function buildContext(db: pg.Client, uid: string, question: string, settings: Settings) {
  const sources: Source[] = [];
  const blocks: string[] = [];
  const add = (label: string, body: string, href?: string) => {
    if (!body.trim()) return;
    const n = sources.length + 1;
    sources.push({ n, label, href });
    blocks.push(`[${n}] ${label}\n${body.trim()}`);
  };
  const on = settings.sources;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

  if (on.tasks) {
    const tasks = await db.query(
      `select t.title, t.status, t.due_date::text due, t.priority, p.name project, left(t.notes, 200) notes
         from public.tasks t left join public.projects p on p.id = t.project_id
        where t.user_id = $1 and t.status in ('todo','doing') and not t.is_demo
        order by t.due_date nulls last, t.priority desc limit 40`, [uid]);
    add("Tareas pendientes del Hub", tasks.rows.map((r) =>
      `- ${r.title}${r.status === "doing" ? " (en curso)" : ""}${r.due ? ` · vence ${r.due}` : ""}${r.project ? ` · proyecto ${r.project}` : ""}${r.notes ? ` · ${clip(r.notes, 200)}` : ""}`).join("\n") || "No hay tareas pendientes.", "/productividad");

    const tracking = await db.query(
      `select title, status, category, due_date::text due, left(notes, 300) notes from public.craft_tracking
        where user_id = $1 and status_key in ('open','in_progress','watching') order by due_date nulls last limit 40`, [uid]);
    add("Asuntos en seguimiento (Craft, «Seguimiento activo»)", tracking.rows.map((r) =>
      `- ${r.title} · ${String(r.status).replace(/^\S+\s/, "")}${r.category ? ` · ${r.category}` : ""}${r.due ? ` · fecha ${r.due}` : ""}${r.notes ? ` · ${clip(r.notes, 300)}` : ""}`).join("\n"), "/productividad");

    const events = await db.query(
      `select coalesce(event_date::text, 'sin fecha') d, end_date::text e, label, raw from public.craft_events
        where user_id = $1 and (event_date is null or coalesce(end_date, event_date) >= $2::date) order by event_date nulls last, position limit 40`, [uid, today]);
    add("Próximos eventos (Informe Diario de Craft, 30 días)", events.rows.map((r) =>
      `- ${r.d}${r.e ? ` a ${r.e}` : ""}: ${clip(String(r.raw ?? r.label).replace(/\*\*/g, ""), 250)}`).join("\n"), "/productividad");
  }

  if (on.running) {
    const recent = await db.query(
      `select id, start_date_local::text d, name, sport_type, distance_m, moving_time_s, average_speed_ms, average_heartrate, suffer_score
         from public.strava_activities where user_id = $1 and not is_demo order by start_date desc limit 12`, [uid]);
    add("Últimas actividades de Strava", recent.rows.map((r) =>
      `- ${r.d.slice(0, 16)} · ${r.sport_type} · ${r.name} · ${km(+r.distance_m)} km · ${hms(r.moving_time_s)} · ${pace(+r.average_speed_ms)}${r.average_heartrate ? ` · FC ${Math.round(r.average_heartrate)}` : ""}${r.suffer_score != null ? ` · esfuerzo ${r.suffer_score}` : ""}`).join("\n"), "/running");

    const months = await db.query(
      `select to_char(date_trunc('month', start_date_local), 'YYYY-MM') m, count(*) n, sum(distance_m) dist, sum(moving_time_s) t
         from public.strava_activities where user_id = $1 and not is_demo and sport_type in ('Run','TrailRun','VirtualRun')
          and start_date_local >= date_trunc('month', now()) - interval '11 months' group by 1 order by 1`, [uid]);
    add("Carrera por meses (últimos 12)", months.rows.map((r) =>
      `- ${r.m}: ${r.n} salidas · ${km(+r.dist)} km · ritmo medio ${pace(+r.dist / +r.t)}`).join("\n"), "/running");

    const prs = await db.query(
      "select distance_key, time_s, achieved_at::date::text d from public.personal_records where user_id = $1 and is_current and not is_demo", [uid]);
    add("Marcas personales vigentes", prs.rows.map((r) => `- ${r.distance_key}: ${hms(r.time_s)} (${r.d})`).join("\n"), "/running");

    // Forma (CTL 42 d), fatiga (ATL 7 d) y frescura (TSB), igual que en la web.
    const load = await db.query(
      `select start_date_local::date::text d, sum(suffer_score) l from public.strava_activities
        where user_id = $1 and not is_demo and suffer_score is not null and start_date_local >= now() - interval '400 days' group by 1`, [uid]);
    if (load.rows.length) {
      const daily = new Map(load.rows.map((r) => [r.d, +r.l]));
      let ctl = 0, atl = 0;
      const d = new Date(Date.now() - 400 * 86_400_000);
      for (let day = d.toISOString().slice(0, 10); day <= today; d.setUTCDate(d.getUTCDate() + 1), day = d.toISOString().slice(0, 10)) {
        const l = daily.get(day) ?? 0;
        ctl += (l - ctl) / 42;
        atl += (l - atl) / 7;
      }
      const tsb = ctl - atl;
      const ready = Math.round(Math.min(100, Math.max(0, ((tsb + 30) / 45) * 100)));
      add("Forma, fatiga y frescura de hoy", `Forma (CTL) ${ctl.toFixed(1)} · Fatiga (ATL) ${atl.toFixed(1)} · Frescura (TSB) ${tsb.toFixed(1)} · Preparación ${ready} %`, "/running");
    }
  }

  if (on.reports) {
    const rep = await db.query(
      "select title, kind, period_start::text d, body_md from public.reports where user_id = $1 and not is_demo order by created_at desc limit 3", [uid]);
    for (const r of rep.rows) add(`Informe del Hub: ${r.title}`, clip(r.body_md, 1500), "/informes");
  }

  if (on.web) {
    const web = await db.query(
      `select title, url, coalesce(summary, excerpt) s from public.web_items where user_id = $1 and not is_demo and (is_saved or fetched_at > now() - interval '3 days')
        order by is_saved desc, published_at desc nulls last limit 10`, [uid]);
    add("Lecturas web recientes o guardadas", web.rows.map((r) => `- ${r.title}${r.s ? `: ${clip(r.s, 200)}` : ""}`).join("\n"), "/web");
  }

  if (on.craft) {
    const words = terms(question);
    if (words.length) {
      const docs = await db.query(
        `select title, folder_path, source_url,
                ts_headline('spanish', search_text, q, 'MaxFragments=4, MaxWords=70, MinWords=25, StartSel="", StopSel="", FragmentDelimiter=" … "') frag
           from public.kb_documents, to_tsquery('spanish', $2) q
          where user_id = $1 and deleted_at is null and fts @@ q and external_id <> $3
            and ($4 or coalesce(folder_path, '') not like 'PERSONAL%')
          order by ts_rank(fts, q) desc, source_updated_at desc nulls last limit 5`,
        [uid, words.map((w) => w.replace(/'/g, "")).join(" | "), MEMORY_ID, !!on.craft_personal]);
      for (const r of docs.rows) add(`Craft: ${r.title}${r.folder_path ? ` (${r.folder_path})` : ""}`, clip(r.frag, 1400), r.source_url ?? undefined);
    }
    if (on.craft_personal) {
      const mem = await db.query("select title, search_text, source_url from public.kb_documents where user_id = $1 and external_id = $2 and deleted_at is null", [uid, MEMORY_ID]);
      if (mem.rows[0]) add(`Craft: ${mem.rows[0].title} (contexto personal)`, clip(mem.rows[0].search_text, 6000), mem.rows[0].source_url ?? undefined);
    }
  }

  return { text: blocks.join("\n\n"), sources };
}

const STYLE: Record<string, string> = {
  breve: "Responde en 1–3 frases, solo lo esencial.",
  normal: "Responde de forma clara y directa, con el contexto justo (normalmente un párrafo corto o una lista breve).",
  detallado: "Responde con explicación y desglose cuando aporte, sin relleno.",
};

/** Instrucciones fijas. Las del usuario se añaden al final y no pueden cambiar estas reglas. */
export function systemPrompt(settings: Settings) {
  const now = new Date().toLocaleString("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return [
    "Eres el asistente del Personal Hub de Marcos, una aplicación personal de productividad, running y conocimiento.",
    `Hoy es ${now} (hora de Madrid).`,
    "Reglas fijas:",
    "- Responde siempre en español y tutea.",
    "- Usa solo la información de los bloques numerados que recibes. Si no está ahí, dilo claramente y no inventes.",
    "- Las cifras deben salir tal cual de los bloques; no calcules estadísticas nuevas salvo sumas o comparaciones evidentes.",
    "- Cita los bloques que uses con su número entre corchetes, por ejemplo [2].",
    "- No tienes herramientas ni puedes cambiar nada: si te piden una acción, explica dónde hacerla en la app.",
    "- Texto plano con listas sencillas si hacen falta; sin tablas, sin encabezados y sin emojis.",
    STYLE[settings.style] ?? STYLE.normal,
    settings.instructions.trim() ? `\nPreferencias del usuario (no cambian las reglas anteriores):\n${settings.instructions.trim()}` : "",
  ].join("\n");
}

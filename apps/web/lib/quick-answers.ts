/**
 * Asistente sin IA (F5-2): reconoce preguntas frecuentes por palabras clave y las responde con
 * consultas a Supabase. Todas las cifras salen de SQL o de código, nunca de un modelo, y todo
 * funciona con AI_PROVIDER=none. Si la pregunta no encaja, se proponen las que sí sabe responder.
 */
import type { getSession } from "@/lib/supabase/server";
import { loadFitness } from "@/lib/fitness-data";
import { freshnessText, readiness } from "@/lib/fitness";
import { capitalize, dateShort, dayShort, duration, km, monthName, monthStartISO, num, pace, todayISO, weekStartISO } from "@/lib/format";
import { craftUrl } from "@/lib/knowledge";
import { statusLabel } from "@/lib/tracking";

type Client = Awaited<ReturnType<typeof getSession>>["supabase"];

export type AnswerRow = { label: string; value?: string; hint?: string; href?: string; strong?: boolean };
export type Answer = {
  intent: string;
  title: string;
  headline?: string;
  unit?: string;
  summary: string;
  rows?: AnswerRow[];
  source: string;
  href?: string;
  hrefLabel?: string;
};

export const SUGGESTIONS = [
  "¿Cuántos kilómetros llevo este mes?",
  "¿Cuántos kilómetros llevo esta semana?",
  "¿Cómo ha evolucionado mi ritmo?",
  "¿Cómo estoy de forma?",
  "¿Cuál fue mi último entrenamiento?",
  "¿Cuáles son mis marcas?",
  "¿Qué tareas tengo pendientes?",
  "¿Qué asuntos tengo en seguimiento?",
  "¿Qué tengo esta semana?",
  "Busca en Craft koleos",
];

const RUN_TYPES = ["Run", "TrailRun", "VirtualRun"];
const PR_LABEL: Record<string, string> = { "1k": "1 km", "5k": "5 km", "10k": "10 km", half_marathon: "Media maratón", marathon: "Maratón" };
const PR_ORDER = ["1k", "5k", "10k", "half_marathon", "marathon"];

const withYear = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" });
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:]/g, " ").replace(/\s+/g, " ").trim();

/** Qué pregunta es. El orden importa: de lo más concreto a lo más general. */
export function matchIntent(question: string): { intent: string; arg?: string } | null {
  const q = norm(question);
  if (!q) return null;
  // Lo que pide redactar, relacionar o razonar lo responde Claude, no una consulta.
  if (/^(prepara|redacta|escribe|haz|hazme|resume|resumeme|analiza|compara|explica|recomienda|aconseja|sugiere)\b/.test(q)
    || /relaciona|vincula|por que|deberia|me conviene|que opinas|resumen semanal/.test(q)) return null;
  const search = q.match(/^(?:busca|buscar|encuentra|encontrar)(?: en mi documentacion| en mis documentos| en mis notas)?(?: de craft)?(?: en craft| en el indice| en conocimiento)?(?: el| la| los| las| un| una)?(?: documento| documentos| nota| notas)?(?: de| sobre| del)? (.+)$/);
  if (search) return { intent: "search", arg: search[1] };
  if (/forma|fatiga|frescura|preparad|cansad|descansad|\bctl\b|\btsb\b/.test(q)) return { intent: "fitness" };
  if (/marca|record|mejores? tiempos?/.test(q)) return { intent: "prs" };
  if (/ultim[oa]s? (carrera|entreno|entrenamiento|salida|rodaje|actividad)/.test(q)) return { intent: "last_run" };
  if (/ritmo|rapido|lento|velocidad/.test(q)) return { intent: "pace" };
  if (/(km|kilometr|corrid|corro|correr|carrera)/.test(q) && /semana/.test(q)) return { intent: "km_week" };
  if (/(km|kilometr|corrid|corro|correr|carrera)/.test(q)) return { intent: "km_month" };
  if (/seguimiento|asuntos?/.test(q)) return { intent: "tracking" };
  if (/tarea|pendiente|que tengo que hacer|por hacer/.test(q)) return { intent: "tasks" };
  if (/evento|agenda|calendario|proxim|que tengo|planes/.test(q)) return { intent: "events" };
  return null;
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function answer(supabase: Client, question: string): Promise<Answer | null> {
  const m = matchIntent(question);
  if (!m) return null;
  switch (m.intent) {
    case "km_month": {
      const start = monthStartISO();
      const prevStart = monthStartISO(-1);
      const { data } = await supabase.from("strava_activities").select("start_date_local,distance_m").in("sport_type", RUN_TYPES).gte("start_date_local", prevStart);
      const day = Number(todayISO().slice(8, 10));
      const runs = data ?? [];
      const cur = runs.filter((a) => a.start_date_local >= start);
      const prevAll = runs.filter((a) => a.start_date_local < start);
      const prevToDate = prevAll.filter((a) => Number(a.start_date_local.slice(8, 10)) <= day);
      const sum = (xs: typeof runs) => xs.reduce((s, a) => s + Number(a.distance_m) / 1000, 0);
      const diff = sum(cur) - sum(prevToDate);
      return {
        intent: m.intent,
        title: `Kilómetros de ${monthName(start)}`,
        headline: num(sum(cur), 1),
        unit: "km",
        summary: `${cur.length} ${cur.length === 1 ? "salida" : "salidas"} este mes. A día ${day} de ${monthName(prevStart)} llevabas ${num(sum(prevToDate), 1)} km: vas ${num(Math.abs(diff), 1)} km ${diff >= 0 ? "por delante" : "por detrás"}.`,
        rows: [{ label: capitalize(monthName(prevStart)), value: `${num(sum(prevAll), 1)} km`, hint: `${prevAll.length} salidas en todo el mes` }],
        source: "Strava · carreras sincronizadas",
        href: "/running",
        hrefLabel: "Ver Running",
      };
    }
    case "km_week": {
      const { data } = await supabase.from("v_running_weekly").select("week_start,km,runs,pace_s_per_km").order("week_start", { ascending: false }).limit(5);
      const byStart = new Map((data ?? []).map((w) => [String(w.week_start).slice(0, 10), w]));
      const cur = byStart.get(weekStartISO());
      const prev = byStart.get(weekStartISO(-1));
      const last4 = [1, 2, 3, 4].map((i) => Number(byStart.get(weekStartISO(-i))?.km ?? 0));
      const avg = last4.reduce((s, x) => s + x, 0) / 4;
      return {
        intent: m.intent,
        title: "Kilómetros de esta semana",
        headline: num(Number(cur?.km ?? 0), 1),
        unit: "km",
        summary: `${cur?.runs ?? 0} ${(cur?.runs ?? 0) === 1 ? "salida" : "salidas"} desde el lunes. La semana pasada hiciste ${num(Number(prev?.km ?? 0), 1)} km y la media de las cuatro anteriores es ${num(avg, 1)} km.`,
        rows: prev?.pace_s_per_km ? [{ label: "Ritmo medio de la semana pasada", value: `${pace(Number(prev.pace_s_per_km))} min/km` }] : undefined,
        source: "Strava · vista semanal",
        href: "/running",
        hrefLabel: "Ver Running",
      };
    }
    case "pace": {
      const { data } = await supabase.from("v_running_monthly").select("month_start,km,runs,pace_s_per_km").order("month_start", { ascending: false }).limit(7);
      const months = (data ?? []).filter((x) => x.pace_s_per_km).reverse();
      if (months.length < 2) return { intent: m.intent, title: "Evolución del ritmo", summary: "Aún no hay meses suficientes para comparar.", source: "Strava · vista mensual" };
      const last = months[months.length - 1];
      const first = months[0];
      const delta = Number(last.pace_s_per_km) - Number(first.pace_s_per_km);
      const best = months.reduce((b, x) => (Number(x.pace_s_per_km) < Number(b.pace_s_per_km) ? x : b));
      const lastLabel = monthName(String(last.month_start));
      return {
        intent: m.intent,
        title: "Evolución del ritmo medio",
        headline: pace(Number(last.pace_s_per_km)),
        unit: "min/km",
        summary: `En ${lastLabel} vas a ${pace(Number(last.pace_s_per_km))} min/km, ${Math.abs(Math.round(delta))} s/km ${delta <= 0 ? "más rápido" : "más lento"} que en ${monthName(String(first.month_start))}. El mejor mes del periodo fue ${monthName(String(best.month_start))} (${pace(Number(best.pace_s_per_km))}).`,
        rows: months.map((x) => ({ label: capitalize(monthName(String(x.month_start))), value: `${pace(Number(x.pace_s_per_km))} min/km`, hint: `${num(Number(x.km), 1)} km · ${x.runs} salidas`, strong: x === last })),
        source: "Strava · ritmo medio ponderado por distancia, por mes",
        href: "/running",
        hrefLabel: "Ver la gráfica de ritmo",
      };
    }
    case "fitness": {
      const series = await loadFitness(supabase);
      const now = series.at(-1);
      if (!now) return { intent: m.intent, title: "Forma, fatiga y frescura", summary: "No hay datos de carga de Strava.", source: "Strava · esfuerzo relativo" };
      const weekAgo = series.at(-8);
      return {
        intent: m.intent,
        title: "Preparación de hoy",
        headline: String(readiness(now.tsb)),
        unit: "%",
        summary: `${freshnessText(now.tsb)}.${weekAgo ? ` Hace una semana la forma era ${num(weekAgo.ctl, 1)}; ahora ${num(now.ctl, 1)} (${now.ctl >= weekAgo.ctl ? "sube" : "baja"}).` : ""}`,
        rows: [
          { label: "Forma (CTL, 42 días)", value: num(now.ctl, 1) },
          { label: "Fatiga (ATL, 7 días)", value: num(now.atl, 1) },
          { label: "Frescura (TSB)", value: `${now.tsb > 0 ? "+" : ""}${num(now.tsb, 1)}` },
        ],
        source: "Strava · esfuerzo relativo de todas las actividades",
        href: "/running",
        hrefLabel: "Ver las gráficas",
      };
    }
    case "prs": {
      const { data } = await supabase.from("personal_records").select("distance_key,time_s,achieved_at,activity_id").eq("is_current", true);
      const prs = (data ?? []).sort((a, b) => PR_ORDER.indexOf(a.distance_key) - PR_ORDER.indexOf(b.distance_key));
      const newest = [...prs].sort((a, b) => b.achieved_at.localeCompare(a.achieved_at))[0];
      return {
        intent: m.intent,
        title: "Marcas personales",
        summary: prs.length ? `La más reciente es la de ${PR_LABEL[newest.distance_key] ?? newest.distance_key}, del ${withYear(newest.achieved_at)}.` : "Aún no hay marcas registradas.",
        rows: prs.map((r) => ({ label: PR_LABEL[r.distance_key] ?? r.distance_key, value: duration(r.time_s), hint: withYear(r.achieved_at), href: r.activity_id ? `/running/${r.activity_id}` : undefined })),
        source: "Strava · mejores esfuerzos",
        href: "/running",
        hrefLabel: "Ver Running",
      };
    }
    case "last_run": {
      const { data } = await supabase.from("strava_activities").select("id,name,start_date,distance_m,moving_time_s,average_heartrate,elevation_gain_m").in("sport_type", RUN_TYPES).order("start_date", { ascending: false }).limit(1);
      const a = data?.[0];
      if (!a) return { intent: m.intent, title: "Último entrenamiento", summary: "No hay carreras sincronizadas.", source: "Strava" };
      return {
        intent: m.intent,
        title: a.name ?? "Último entrenamiento",
        headline: km(a.distance_m, 2),
        unit: "km",
        summary: `${capitalize(dateShort(a.start_date))}: ${duration(a.moving_time_s)} a ${pace(a.distance_m ? a.moving_time_s / (Number(a.distance_m) / 1000) : null)} min/km${a.average_heartrate ? `, ${num(Number(a.average_heartrate))} ppm de media` : ""}${a.elevation_gain_m ? ` y ${num(Number(a.elevation_gain_m))} m de desnivel` : ""}.`,
        source: "Strava",
        href: `/running/${a.id}`,
        hrefLabel: "Ver el entrenamiento",
      };
    }
    case "tasks": {
      const [tasksRes, trackRes] = await Promise.all([
        supabase.from("v_tasks_pending").select("id,title,due_date,overdue,project_name").order("due_date", { ascending: true, nullsFirst: false }).order("priority"),
        supabase.from("craft_tracking").select("external_id", { count: "exact", head: true }).in("status_key", ["open", "in_progress", "watching"]),
      ]);
      const tasks = tasksRes.data ?? [];
      const overdue = tasks.filter((t) => t.overdue).length;
      const tracking = trackRes.count ?? 0;
      return {
        intent: m.intent,
        title: "Tareas pendientes",
        headline: String(tasks.length),
        unit: tasks.length === 1 ? "tarea" : "tareas",
        summary: `${tasks.length ? `${overdue ? `${overdue} ${overdue === 1 ? "vencida" : "vencidas"}. ` : "Ninguna vencida. "}` : "No tienes tareas pendientes en el Hub. "}Además hay ${tracking} ${tracking === 1 ? "asunto" : "asuntos"} en seguimiento en Craft.`,
        rows: tasks.slice(0, 8).map((t) => ({ label: t.title ?? "", hint: t.project_name ?? undefined, value: t.due_date ? dayShort(t.due_date) : undefined, strong: !!t.overdue })),
        source: "Hub · tareas; Craft · Seguimiento activo",
        href: "/productividad",
        hrefLabel: "Ver Productividad",
      };
    }
    case "tracking": {
      const { data } = await supabase.from("craft_tracking").select("title,status,due_date,category").in("status_key", ["open", "in_progress", "watching"]).order("due_date", { ascending: true, nullsFirst: false });
      const items = data ?? [];
      const today = todayISO();
      const soon = items.filter((t) => t.due_date && t.due_date >= today && t.due_date <= addDays(today, 7)).length;
      return {
        intent: m.intent,
        title: "Asuntos en seguimiento",
        headline: String(items.length),
        unit: items.length === 1 ? "asunto" : "asuntos",
        summary: `${soon} con fecha en los próximos 7 días. Ordenados por fecha; los que no tienen fecha van al final.`,
        rows: items.slice(0, 10).map((t) => ({ label: t.title, hint: [statusLabel(t.status), t.category].filter(Boolean).join(" · "), value: t.due_date ? dayShort(t.due_date) : undefined, strong: !!t.due_date && t.due_date < today })),
        source: "Craft · 🗂️ Seguimiento activo",
        href: "/productividad",
        hrefLabel: "Ver y editar en Productividad",
      };
    }
    case "events": {
      const today = todayISO();
      const { data } = await supabase.from("craft_events").select("event_date,end_date,label,items,report_date").gte("event_date", today).lte("event_date", addDays(today, 7)).order("position");
      const events = data ?? [];
      return {
        intent: m.intent,
        title: "Próximos 7 días",
        summary: events.length ? `Del Informe Diario del ${dayShort(events[0].report_date)}. En negrita, lo marcado como importante.` : "No hay eventos en los próximos 7 días.",
        rows: events.map((e) => {
          const items = (Array.isArray(e.items) ? e.items : []) as { text: string; important?: boolean }[];
          return { label: e.label, value: items.map((i) => i.text).join(" · "), strong: items.some((i) => i.important) };
        }),
        source: "Craft · 📰 Informe Diario",
        href: "/productividad",
        hrefLabel: "Ver los 30 días",
      };
    }
    case "search": {
      const q = (m.arg ?? "").slice(0, 200);
      const { data } = await supabase
        .from("kb_documents")
        .select("external_id,title,folder_path,source_url,source_updated_at")
        .is("deleted_at", null)
        .textSearch("fts", q, { type: "websearch", config: "spanish" })
        .order("source_updated_at", { ascending: false, nullsFirst: false })
        .limit(6);
      const docs = data ?? [];
      return {
        intent: m.intent,
        title: `Craft: «${q}»`,
        summary: docs.length ? `${docs.length === 6 ? "Los 6 más recientes" : `${docs.length} ${docs.length === 1 ? "documento" : "documentos"}`} que mencionan «${q}».` : `Nada en el índice de Craft con «${q}».`,
        rows: docs.map((d) => ({ label: d.title, hint: d.folder_path ?? undefined, value: d.source_updated_at ? dateShort(d.source_updated_at) : undefined, href: d.source_url ?? craftUrl(d.external_id) })),
        source: "Craft · índice de búsqueda",
        href: `/conocimiento?q=${encodeURIComponent(q)}`,
        hrefLabel: "Ver todos en Conocimiento",
      };
    }
  }
  return null;
}

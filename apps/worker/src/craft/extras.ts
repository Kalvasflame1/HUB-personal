/**
 * Próximos eventos y asuntos en seguimiento, leídos de Craft (solo lectura).
 *
 * - Eventos: la sección «📅 Próximos eventos — 30 días vista» del último «📰 Informe Diario»
 *   de Cowork. Cada viñeta «- 🛒 **Sábado 21** · compra · **rodaje largo**» es un día; los
 *   elementos en negrita se marcan como importantes. Lectura tolerante: si una línea no
 *   encaja, se guarda tal cual sin fecha. Se sustituye entera en cada lectura.
 * - Seguimiento: la colección «Seguimiento» de «🗂️ Seguimiento activo» (no el archivo).
 *   Se guarda cada asunto con su estado; la web muestra los abiertos, en curso y en seguimiento.
 *
 * - Cambios desde la app: la única escritura en Craft (autorizada el 21-11-2026), solo en la
 *   tabla «Seguimiento» y solo título, categoría, estado, fecha y notas, con su propia conexión
 *   de escritura (CRAFT_WRITE_API_URL / CRAFT_WRITE_API_KEY). Ver applyTrackingChanges.
 *
 *   npm run craft:extras --workspace apps/worker             lee eventos y seguimiento
 *   npm run craft:extras --workspace apps/worker -- --apply  aplica los cambios pendientes
 */
import type pg from "pg";
import { env, USER_ID } from "../db.ts";
import { runJob, type JobResult } from "../jobs.ts";

const NEWS_FOLDER_PATH = "NOTICIAS / 📰 Informe Diario";
const TRACKING_DOC = "6b67fea5-f7cf-1103-1c76-38da1e77efbc"; // 🗂️ Seguimiento activo
const TRACKING_NAME = "Seguimiento";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const STATUS_KEYS: [RegExp, string][] = [
  [/abierto/i, "open"],
  [/en curso/i, "in_progress"],
  [/seguimiento/i, "watching"],
  [/hecho/i, "done"],
  [/caducado/i, "expired"],
];

// ---------- API (misma cadencia que el índice: menos de una petición cada 0,7 s) ----------
let lastCall = 0;
async function craft(path: string, params: Record<string, string> = {}, accept = "application/json", write?: { method: string; body: unknown }) {
  // Las escrituras van por su propia conexión (CRAFT_WRITE_*); las lecturas, por la de solo lectura
  const base = write ? env("CRAFT_WRITE_API_URL") : env("CRAFT_API_URL");
  const key = write ? env("CRAFT_WRITE_API_KEY") : env("CRAFT_API_KEY");
  const url = new URL(base.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    const wait = lastCall + 700 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const res = await fetch(url, {
      method: write?.method ?? "GET",
      headers: { authorization: `Bearer ${key}`, accept, ...(write ? { "content-type": "application/json" } : {}) },
      body: write ? JSON.stringify(write.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, (Number(res.headers.get("x-ratelimit-reset")) || 60) * 1000));
      continue;
    }
    // Craft da a veces 502/503 pasajeros (Cloudflare): se reintenta con espera creciente
    if (res.status >= 500 && attempt < 3 && !write) {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Craft ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res;
  }
}

// ---------- Utilidades ----------
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu;
const clean = (s: string) => s.replace(EMOJI, "").replace(/\s+/g, " ").trim();
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** «📰 Sábado 21 de noviembre de 2026» → 2026-11-21 */
export function titleDate(title: string): string | null {
  const m = title.toLowerCase().match(/(\d{1,2}) de ([a-záéíóú]+) de (\d{4})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]) + 1;
  return month ? iso(Number(m[3]), month, Number(m[1])) : null;
}

export type ParsedEvent = { event_date: string | null; end_date: string | null; label: string; icons: string | null; items: { text: string; important: boolean }[]; raw: string };

/** Extrae y lee la sección de próximos eventos de un informe en markdown. */
export function parseEvents(markdown: string, reportDate: string): ParsedEvent[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^\s*#{1,4}\s.*Próximos eventos/i.test(l));
  if (start < 0) return [];
  const out: ParsedEvent[] = [];
  let [y, m, d] = reportDate.split("-").map(Number);
  // Avanza el mes cuando el día baja (la lista va en orden cronológico)
  const toDate = (day: number) => {
    if (day < d) m === 12 ? ((m = 1), y++) : m++;
    d = day;
    return iso(y, m, day);
  };
  for (const line of lines.slice(start + 1)) {
    if (/^\s*#{1,4}\s/.test(line)) break; // siguiente sección
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (!bullet) continue;
    const raw = bullet[1].trim();
    if (!raw) continue;
    const parts = raw.match(/^(.*?)\*\*(.+?)\*\*\s*(?:·\s*)?(.*)$/);
    if (!parts) {
      out.push({ event_date: null, end_date: null, label: clean(raw.replace(/\*\*/g, "")), icons: null, items: [], raw });
      continue;
    }
    const label = clean(parts[2]);
    const nums = (label.match(/\d{1,2}/g) ?? []).map(Number);
    let event_date: string | null = null;
    let end_date: string | null = null;
    if (nums.length) {
      event_date = toDate(nums[0]);
      if (nums.length > 1 && /\sa\s/i.test(label)) end_date = toDate(nums[nums.length - 1]);
    }
    const items = parts[3]
      .split(/\s+·\s+/)
      .map((t) => ({ text: clean(t.replace(/\*\*/g, "")), important: /\*\*.+\*\*/.test(t) }))
      .filter((t) => t.text);
    const icons = parts[1].match(EMOJI) ? parts[1].trim() : null;
    out.push({ event_date, end_date, label, icons, items, raw });
  }
  return out;
}

/**
 * D4 (21-11-2026): copia de lectura del Informe Diario de Cowork para mostrarlo en el Hub.
 * Se guarda el markdown sin las etiquetas de página y sin sangría; se conservan los 7 últimos.
 */
async function saveDailyReport(db: pg.Client, doc: { external_id: string; title: string; source_url: string | null; date: string }, md: string) {
  const clean = md
    .replace(/<\/?(page|content)\b[^>]*>/g, "")
    .replace(/<pageTitle>[\s\S]*?<\/pageTitle>/g, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 100_000);
  await db.query(
    `insert into public.craft_daily_reports (user_id, external_id, report_date, title, markdown, source_url)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id, report_date) do update set external_id = excluded.external_id, title = excluded.title,
       markdown = excluded.markdown, source_url = excluded.source_url, fetched_at = now()
     where craft_daily_reports.markdown is distinct from excluded.markdown`,
    [USER_ID(), doc.external_id, doc.date, doc.title, clean, doc.source_url],
  );
  await db.query(
    `delete from public.craft_daily_reports where user_id = $1 and report_date not in
       (select report_date from public.craft_daily_reports where user_id = $1 order by report_date desc limit 7)`,
    [USER_ID()],
  );
}

async function readEvents(db: pg.Client) {
  // El índice de Craft ya conoce los informes: se elige el de fecha más reciente según su título
  const { rows } = await db.query<{ external_id: string; title: string; source_url: string | null }>(
    `select external_id, title, source_url from public.kb_documents
      where user_id = $1 and deleted_at is null and folder_path = $2
      order by source_updated_at desc nulls last limit 15`,
    [USER_ID(), NEWS_FOLDER_PATH],
  );
  const latest = rows
    .map((r) => ({ ...r, date: titleDate(r.title) }))
    .filter((r): r is typeof r & { date: string } => !!r.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest) return { events: 0, report: null };

  const md = await (await craft("/blocks", { id: latest.external_id }, "text/markdown")).text();
  await saveDailyReport(db, latest, md);
  const events = parseEvents(md, latest.date);
  if (events.length === 0) return { events: 0, report: latest.date, note: "sin sección de eventos" };

  await db.query("begin");
  try {
    await db.query("delete from public.craft_events where user_id = $1", [USER_ID()]);
    for (const [i, e] of events.entries()) {
      await db.query(
        `insert into public.craft_events (user_id, event_date, end_date, label, icons, items, raw, position, report_doc, report_date, source_url)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [USER_ID(), e.event_date, e.end_date, e.label, e.icons, JSON.stringify(e.items), e.raw, i, latest.external_id, latest.date, latest.source_url],
      );
    }
    await db.query("commit");
  } catch (err) {
    await db.query("rollback");
    throw err;
  }
  return { events: events.length, undated: events.filter((e) => !e.event_date).length, report: latest.date };
}

type CollectionItem = { id: string; asunto?: string; title?: string; properties?: Record<string, unknown> };

async function trackingCollection() {
  const { items: collections } = (await (await craft("/collections", { documentId: TRACKING_DOC })).json()) as { items: { id: string; name: string; documentId: string }[] };
  const col = collections.find((c) => c.documentId === TRACKING_DOC && c.name.trim() === TRACKING_NAME);
  if (!col) throw new Error(`No encuentro la colección «${TRACKING_NAME}» en Seguimiento activo`);
  const { items } = (await (await craft(`/collections/${col.id}/items`, { maxDepth: "0" })).json()) as { items: CollectionItem[] };
  return { id: col.id, items };
}

async function readTracking(db: pg.Client) {
  const { items } = await trackingCollection();

  const { rows: doc } = await db.query<{ source_url: string | null }>(
    "select source_url from public.kb_documents where user_id = $1 and external_id = $2",
    [USER_ID(), TRACKING_DOC],
  );
  const url = doc[0]?.source_url ?? null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  await db.query("begin");
  try {
    for (const it of items) {
      const p = it.properties ?? {};
      const status = str(p.estado);
      const key = status ? (STATUS_KEYS.find(([re]) => re.test(status))?.[1] ?? "other") : null;
      const due = str(p.fecha);
      await db.query(
        `insert into public.craft_tracking (user_id, external_id, title, category, status, status_key, due_date, period, notes, source_url, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
         on conflict (user_id, external_id) do update set
           title = excluded.title, category = excluded.category, status = excluded.status, status_key = excluded.status_key,
           due_date = excluded.due_date, period = excluded.period, notes = excluded.notes, source_url = excluded.source_url, updated_at = now()`,
        [USER_ID(), it.id, str(it.asunto ?? it.title) ?? "(sin título)", str(p.categoria), status, key, due && /^\d{4}-\d{2}-\d{2}/.test(due) ? due.slice(0, 10) : null, str(p.periodo), str(p.notas), url],
      );
    }
    // Lo que ya no está en la tabla (borrado o pasado al archivo) desaparece
    await db.query("delete from public.craft_tracking where user_id = $1 and not (external_id = any($2))", [USER_ID(), items.map((i) => i.id)]);
    await db.query("commit");
  } catch (err) {
    await db.query("rollback");
    throw err;
  }
  const active = items.filter((i) => /abierto|en curso|seguimiento/i.test(String(i.properties?.estado ?? ""))).length;
  return { tracking: items.length, active };
}

// ---------- Cambios pedidos desde la app (única escritura en Craft, autorizada el 21-11-2026) ----------
type Fields = { title?: string | null; category?: string | null; status?: string | null; due_date?: string | null; notes?: string | null };
const PROP: Record<string, string> = { category: "categoria", status: "estado", due_date: "fecha", notes: "notas" };

function current(it: CollectionItem): Fields {
  const p = it.properties ?? {};
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const due = str(p.fecha);
  return { title: str(it.asunto ?? it.title), category: str(p.categoria), status: str(p.estado), due_date: due ? due.slice(0, 10) : null, notes: str(p.notas) };
}

export const pendingTrackingChanges = async (db: pg.Client) =>
  Number((await db.query("select count(*) from public.craft_tracking_changes where user_id = $1 and state = 'pending'", [USER_ID()])).rows[0].count);

/**
 * Aplica en Craft los cambios de la cola. Antes de escribir compara cada campo que se quiere
 * cambiar con su valor en Craft: si ya no es el que vio la app (Cowork lo cambió), no escribe,
 * marca un conflicto y avisa. Solo toca título, categoría, estado, fecha y notas.
 */
export async function applyTrackingChanges(db: pg.Client): Promise<JobResult> {
  const uid = USER_ID();
  const { rows } = await db.query<{ id: string; external_id: string; changes: Fields; base: Fields }>(
    "select id, external_id, changes, base from public.craft_tracking_changes where user_id = $1 and state = 'pending' order by created_at",
    [uid],
  );
  if (!rows.length) return { status: "skipped", items: 0, message: "sin cambios pendientes" };
  if (!process.env.CRAFT_WRITE_API_URL?.trim() || !process.env.CRAFT_WRITE_API_KEY?.trim()) {
    return { status: "skipped", items: 0, message: `${rows.length} cambios esperando: falta la conexión de escritura de Craft en apps/worker/.env` };
  }
  const { id: collectionId, items } = await trackingCollection();
  const byId = new Map(items.map((i) => [i.id, i]));
  const result = { applied: 0, conflict: 0, error: 0 };
  // Varios cambios seguidos del mismo asunto: cada uno se compara con lo que dejó el anterior
  const written = new Map<string, Fields>();

  for (const r of rows) {
    const item = byId.get(r.external_id);
    const set = async (state: string, error: string | null) => {
      await db.query("update public.craft_tracking_changes set state = $2, error = $3, applied_at = now() where id = $1", [r.id, state, error]);
      result[state as keyof typeof result]++;
    };
    if (!item) {
      await set("error", "El asunto ya no está en la tabla de Seguimiento de Craft");
      continue;
    }
    const now = { ...current(item), ...written.get(r.external_id) };
    const keys = Object.keys(r.changes) as (keyof Fields)[];
    const moved = keys.filter((k) => (now[k] ?? null) !== (r.base[k] ?? null));
    if (moved.length) {
      await set("conflict", `Cambió en Craft: ${moved.join(", ")}`);
      await db.query(
        "insert into public.notifications (user_id, level, title, body, link) values ($1, 'warning', $2, $3, '/productividad')",
        [uid, `No se guardó en Craft: ${String(r.base.title ?? "asunto")}`.slice(0, 200), "El asunto cambió en Craft (probablemente Cowork) después de que lo editaras. Revísalo y vuelve a editarlo si hace falta."],
      );
      continue;
    }
    const update: { id: string; asunto?: string; properties?: Record<string, string> } = { id: r.external_id };
    for (const k of keys) {
      const v = r.changes[k];
      // La API de Craft no acepta vaciar campos (ni null ni ""): esos se ignoran
      if (v == null || v === "") continue;
      if (k === "title") update.asunto = v;
      else (update.properties ??= {})[PROP[k]] = v;
    }
    if (!update.asunto && !update.properties) {
      await set("error", "Craft no permite vaciar la fecha, la categoría ni las notas");
      continue;
    }
    try {
      await craft(`/collections/${collectionId}/items`, {}, "application/json", { method: "PUT", body: { itemsToUpdate: [update] } });
      written.set(r.external_id, { ...written.get(r.external_id), ...r.changes });
      await set("applied", null);
    } catch (e) {
      await set("error", (e as Error).message.slice(0, 500));
    }
  }
  // Releer para que la app muestre lo que hay de verdad en Craft
  if (result.applied) await readTracking(db);
  return { items: result.applied, details: result, message: `${result.applied} guardados en Craft · ${result.conflict} conflictos · ${result.error} errores` };
}

export async function readCraftExtras(db: pg.Client): Promise<JobResult> {
  const ev = await readEvents(db);
  const tr = await readTracking(db);
  return {
    items: ev.events + tr.tracking,
    details: { ...ev, ...tr },
    message: `${ev.events} eventos (informe del ${ev.report ?? "?"}) · ${tr.active} asuntos activos de ${tr.tracking}`,
  };
}

if (import.meta.main) {
  const r = process.argv.includes("--apply")
    ? await runJob("craft_changes", applyTrackingChanges)
    : await runJob("craft_extras", readCraftExtras);
  process.exit(r.ok ? 0 : 1);
}

/**
 * Índice de Craft (solo lectura).
 *
 * Recorre el espacio con la API de Craft (CRAFT_API_URL + CRAFT_API_KEY, conexión de solo lectura)
 * y guarda en public.kb_documents un índice de búsqueda con enlace al original. Craft sigue siendo
 * la fuente: aquí solo hay título, ruta, extracto y texto plano para buscar.
 *
 * Reglas (docs/KNOWLEDGE_BASE.md §9):
 * - Fuera del índice: «How to use Craft», NOTION, las plantillas de ejemplo, Plantillas y Papelera.
 * - 📰 Informe Diario: solo título, fecha y extracto.
 * - El resto (PERSONAL incluida, con la Memoria del resumen diario): texto completo.
 * Incremental: solo se vuelve a leer un documento si cambió su fecha de modificación.
 * Los documentos que ya no están (o pasan a excluidos) se marcan con deleted_at.
 *
 *   npm run craft:index --workspace apps/worker            incremental
 *   npm run craft:index --workspace apps/worker -- --full  vuelve a leerlo todo
 */
import { createHash } from "node:crypto";
import type pg from "pg";
import { env, USER_ID } from "../db.ts";
import { runJob, type JobResult } from "../jobs.ts";

const EXCLUDED_FOLDERS = new Set(["27b63c0d-3e81-0751-6198-cfdffba2c22c" /* How to use Craft */, "4020129E-6128-42AB-8F1F-4462D8010D71" /* NOTION */]);
const EXCLUDED_DOCS = new Set([
  "637c6acd-7cae-4609-45d5-83c94fd71f72", // Q3 Planning Meeting - Product Team
  "439d5fa4-5f4f-85f3-e513-e6f36ebd0466", // Lumina Mobile App Project Dashboard
  "83cda814-1740-bdf5-cf5a-3f30ae9f26e4", // Lumina - Mobile App Project Dashboard
  "425317e7-daab-267b-bf82-205ee6430d2b", // Weekly Review Guide
  "47ef9232-d2c1-8966-65bd-d4fe428a679d", // How to Do a Weekly Review
  "de7ff6b1-971d-e484-8eda-cddfea8eb4d5", // Nota de Reunión - Planificación Q3
]);
const NEWS_FOLDER = "5355d714-a664-8a7a-e960-71b063c4cf51"; // 📰 Informe Diario
const REPORT_FOLDERS = new Set([NEWS_FOLDER, "5d4464e5-7369-6494-e087-3543e5727883", "4bb4b964-eaa1-d1c3-3a72-7940a0c5ae40", "f78c2d8a-8b7a-02d6-08f9-b2802d612136"]);
/** Documentos cuyo bloque raíz no lleva el título real. */
const TITLE_OVERRIDES: Record<string, string> = {
  "f1422cc7-82fa-9911-d31b-637c6f868433": "🧠 Memoria e Información Importante",
};
const LOCATIONS = [
  { id: "unsorted", path: "Sin clasificar" },
  { id: "daily_notes", path: "Notas diarias" },
];
const MAX_TEXT = 200_000;
const EXCERPT = 300;

type Folder = { id: string; name: string; folders?: Folder[] };
type Doc = { id: string; title: string; lastModifiedAt?: string; clickableLink?: string; dailyNoteDate?: string };
type Entry = Doc & { path: string; folderId: string };

// ---------- API ----------
let lastCall = 0;
export async function craft(path: string, params: Record<string, string> = {}, accept = "application/json"): Promise<Response> {
  const url = new URL(env("CRAFT_API_URL").replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    // Límite de Craft: 100 peticiones por minuto en el espacio; se va a menos de una por 0,7 s
    const wait = lastCall + 700 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const res = await fetch(url, { headers: { authorization: `Bearer ${env("CRAFT_API_KEY")}`, accept }, signal: AbortSignal.timeout(30_000) });
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, (Number(res.headers.get("x-ratelimit-reset")) || 60) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Craft ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res;
  }
}
const json = async <T>(path: string, params?: Record<string, string>) => (await (await craft(path, params)).json()) as T;

// ---------- Texto ----------
export function plain(md: string) {
  return md
    .replace(/<pageTitle>[\s\S]*?<\/pageTitle>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/\[[ xX]\]\s*/g, "")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/\|/g, " ")
    .replace(/^\s*:?-{3,}:?\s*$/gm, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

// ---------- Inventario ----------
async function inventory() {
  const { items } = await json<{ items: Folder[] }>("/folders");
  const found = new Map<string, Entry>();
  const visit = async (f: Folder, parents: string[]) => {
    if (EXCLUDED_FOLDERS.has(f.id) || ["trash", "templates", "unsorted", "daily_notes"].includes(f.id)) return;
    const path = [...parents, f.name];
    // folderId incluye subcarpetas: se recorre de arriba abajo y cada documento se queda con la ruta más profunda
    const { items: docs } = await json<{ items: Doc[] }>("/documents", { folderId: f.id, fetchMetadata: "true" });
    for (const d of docs) found.set(d.id, { ...d, path: path.join(" / "), folderId: f.id });
    for (const sub of f.folders ?? []) await visit(sub, path);
  };
  for (const f of items) await visit(f, []);
  for (const loc of LOCATIONS) {
    const { items: docs } = await json<{ items: Doc[] }>("/documents", { location: loc.id, fetchMetadata: "true" });
    for (const d of docs) if (!found.has(d.id)) found.set(d.id, { ...d, path: loc.path, folderId: loc.id });
  }
  for (const id of EXCLUDED_DOCS) found.delete(id);
  return found;
}

function kind(e: Entry) {
  if (e.folderId === "daily_notes") return "daily_note";
  if (REPORT_FOLDERS.has(e.folderId)) return "report";
  return "note";
}

// ---------- Tarea ----------
export async function indexCraft(db: pg.Client, opts: { full?: boolean } = {}): Promise<JobResult> {
  const uid = USER_ID();
  const docs = await inventory();
  const { rows: known } = await db.query<{ external_id: string; source_updated_at: Date | null; deleted_at: Date | null; content_hash: string | null }>(
    "select external_id, source_updated_at, deleted_at, content_hash from public.kb_documents where user_id = $1 and source = 'craft'",
    [uid],
  );
  const byId = new Map(known.map((k) => [k.external_id, k]));

  let read = 0, changed = 0, unchanged = 0;
  const errors: { title: string; error: string }[] = [];
  for (const e of docs.values()) {
    const prev = byId.get(e.id);
    const modified = e.lastModifiedAt ? new Date(e.lastModifiedAt) : null;
    const same = !opts.full && prev && !prev.deleted_at && modified && prev.source_updated_at?.getTime() === modified.getTime();
    if (same) { unchanged++; continue; }

    try {
      const news = e.folderId === NEWS_FOLDER;
      // Informes de noticias: basta el primer nivel para el extracto
      const md = await (await craft("/blocks", { id: e.id, ...(news ? { maxDepth: "2" } : {}) }, "text/markdown")).text();
      read++;
      const text = plain(md);
      const title = TITLE_OVERRIDES[e.id] ?? (e.title?.trim() || e.dailyNoteDate || "(sin título)");
      const body = text.startsWith(title) ? text.slice(title.length).trim() : text;
      const digest = hash(md);
      const searchText = news ? cut(body, EXCERPT) : cut(body, MAX_TEXT);
      const r = await db.query(
        `insert into public.kb_documents
           (user_id, source, external_id, title, folder_path, doc_kind, excerpt, search_text, content_hash, source_updated_at, source_url, indexed_at, deleted_at)
         values ($1, 'craft', $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), null)
         on conflict (user_id, source, external_id) do update set
           title = excluded.title, folder_path = excluded.folder_path, doc_kind = excluded.doc_kind,
           excerpt = excluded.excerpt, search_text = excluded.search_text, content_hash = excluded.content_hash,
           source_updated_at = excluded.source_updated_at, source_url = excluded.source_url,
           indexed_at = now(), deleted_at = null
         returning (xmax = 0) as inserted`,
        [uid, e.id, title, e.path, kind(e), cut(body, EXCERPT) || null, searchText || null, digest, modified, e.clickableLink ?? null],
      );
      if (r.rows[0]?.inserted || prev?.content_hash !== digest) changed++;
      else unchanged++;
    } catch (err) {
      errors.push({ title: e.title, error: (err as Error).message });
    }
  }

  // Lo que ya no está en Craft (o quedó excluido) se marca, no se borra
  const gone = await db.query(
    `update public.kb_documents set deleted_at = now()
      where user_id = $1 and source = 'craft' and deleted_at is null and not (external_id = any($2))`,
    [uid, [...docs.keys()]],
  );

  if (errors.length && read === 0) {
    throw new Error(`No se pudo leer ningún documento: ${errors[0].error}`);
  }
  return {
    items: changed,
    details: { documents: docs.size, read, changed, unchanged, removed: gone.rowCount ?? 0, errors: errors.slice(0, 10), errorCount: errors.length },
    message: `${docs.size} documentos, ${changed} nuevos o cambiados, ${gone.rowCount ?? 0} retirados${errors.length ? `, ${errors.length} con error` : ""}`,
  };
}

if (import.meta.main) {
  const full = process.argv.includes("--full");
  const r = await runJob("craft_index", (db) => indexCraft(db, { full }));
  if (!r.ok) process.exitCode = 1;
}

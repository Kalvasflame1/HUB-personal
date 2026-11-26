/**
 * Proyectos del Hub con respaldo en Craft (autorizado por el usuario el 26-11-2026).
 *
 * - Cada proyecto (no demo) tiene una carpeta propia dentro de «📁 PROYECTOS HUB» y, en ella,
 *   un documento «📋 Ficha del proyecto» con la descripción, el estado y sus tareas.
 * - La ficha la genera el worker: se reescribe entera cuando cambia algo (huella en
 *   projects.craft_sync_hash). Lo que el usuario quiera conservar va en otros documentos de la
 *   carpeta, que nunca se tocan y se enlazan al proyecto en la app (kb_links, created_by
 *   'assistant') cuando el índice de Craft ya los conoce.
 * - Nunca se borra ni se mueve nada en Craft: al terminar o archivar un proyecto, la ficha lo
 *   refleja y la carpeta se queda.
 * - Conexión propia, limitada a esa carpeta (o al espacio si Craft no permite limitarla):
 *   CRAFT_PROJECTS_API_URL / CRAFT_PROJECTS_API_KEY. Sin ella el trabajo se salta sin error.
 *
 *   npm run craft:projects --workspace apps/worker             crea y actualiza
 *   npm run craft:projects --workspace apps/worker -- --dry-run solo muestra qué haría
 */
import { createHash } from "node:crypto";
import type pg from "pg";
import { USER_ID } from "../db.ts";
import { runJob, type JobResult } from "../jobs.ts";

// «📁 PROYECTOS HUB», creada el 26-11-2026
const PARENT_FOLDER = process.env.CRAFT_PROJECTS_FOLDER_ID?.trim() || "66d03639-97fc-25b5-f114-48543bc55505";
const FICHA_TITLE = "📋 Ficha del proyecto";
const STATUS_LABEL: Record<string, string> = { active: "🟢 Activo", paused: "⏸️ Pausado", done: "✅ Terminado", archived: "🗄️ Archivado" };
const TASK_STATUS: Record<string, string> = { todo: "Pendiente", doing: "En curso", done: "Hecha", cancelled: "Cancelada" };
const PRIORITY = ["", "máxima", "alta", "media", "baja"];

const configured = () => !!process.env.CRAFT_PROJECTS_API_URL?.trim() && !!process.env.CRAFT_PROJECTS_API_KEY?.trim();

// ---------- API (misma cadencia que el resto: menos de una petición cada 0,7 s) ----------
let lastCall = 0;
async function api<T = unknown>(path: string, opts: { method?: string; params?: Record<string, string>; body?: unknown } = {}): Promise<T> {
  const url = new URL(process.env.CRAFT_PROJECTS_API_URL!.trim().replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(opts.params ?? {})) url.searchParams.set(k, v);
  const method = opts.method ?? "GET";
  for (let attempt = 0; ; attempt++) {
    const wait = lastCall + 700 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${process.env.CRAFT_PROJECTS_API_KEY!.trim()}`,
        accept: "application/json",
        ...(opts.body ? { "content-type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, (Number(res.headers.get("x-ratelimit-reset")) || 60) * 1000));
      continue;
    }
    // Solo las lecturas se reintentan ante 5xx: una escritura repetida podría duplicar
    if (res.status >= 500 && attempt < 3 && method === "GET") {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Craft ${method} ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }
}

/** Primer id de una respuesta de creación ({ items: [{ id }] } o { id }). */
function createdId(r: unknown): string {
  const o = r as { items?: { id?: string }[]; id?: string; folders?: { id?: string }[]; documents?: { id?: string }[] };
  const id = o.items?.[0]?.id ?? o.folders?.[0]?.id ?? o.documents?.[0]?.id ?? o.id;
  if (!id) throw new Error(`Respuesta de Craft sin id: ${JSON.stringify(r).slice(0, 200)}`);
  return id;
}

const createFolder = async (name: string) =>
  createdId(await api("/folders", { method: "POST", body: { folders: [{ name, parentFolderId: PARENT_FOLDER }] } }));

const createDocument = async (title: string, folderId: string) =>
  createdId(await api("/documents", { method: "POST", body: { documents: [{ title }], destination: { folderId } } }));

/** Sustituye el contenido de la ficha (solo los bloques de dentro; el documento se queda). */
async function rewriteDocument(docId: string, markdown: string) {
  const page = await api<{ content?: { id: string }[] }>("/blocks", { params: { id: docId, maxDepth: "1" } });
  const ids = (page.content ?? []).map((b) => b.id);
  if (ids.length) await api("/blocks", { method: "DELETE", body: { blockIds: ids } });
  await api("/blocks", { method: "POST", body: { markdown, position: { position: "end", pageId: docId } } });
}

// ---------- Contenido de la ficha ----------
type Project = {
  id: string; name: string; description: string | null; status: string; created_at: Date;
  craft_folder_id: string | null; craft_doc_id: string | null; craft_sync_hash: string | null;
};
type Task = { title: string; status: string; priority: number; due_date: string | null; completed: string | null; notes: string | null };

const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

export function fichaMarkdown(p: Project, tasks: Task[]) {
  const open = tasks.filter((t) => t.status === "todo" || t.status === "doing");
  const done = tasks.filter((t) => t.status === "done");
  const total = open.length + done.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const line = (t: Task) => {
    const bits = [
      t.status === "doing" ? "en curso" : null,
      t.due_date ? `vence ${day(t.due_date)}` : null,
      t.status !== "done" ? `prioridad ${PRIORITY[t.priority] ?? "media"}` : null,
      t.completed ? `hecha ${day(t.completed)}` : null,
    ].filter(Boolean);
    const box = t.status === "done" ? "[x]" : "[ ]";
    const notes = t.notes?.trim() ? `\n  ${t.notes.trim().replace(/\s+/g, " ").slice(0, 300)}` : "";
    return `- ${box} ${t.title}${bits.length ? ` · ${bits.join(" · ")}` : ""}${notes}`;
  };
  return [
    `> Ficha generada por el Hub a partir de sus tareas. Se reescribe sola cuando cambian: no la edites aquí. Para notas, investigación o presupuestos, crea otros documentos en esta carpeta; aparecerán enlazados al proyecto en la app.`,
    `## ${p.name}`,
    `**Estado:** ${STATUS_LABEL[p.status] ?? p.status} · **Progreso:** ${done.length}/${total} tareas (${pct} %) · **Creado:** ${day(p.created_at.toISOString().slice(0, 10))}`,
    p.description?.trim() ? `### Descripción\n${p.description.trim()}` : `### Descripción\n*Sin descripción. Añádela desde la app (Productividad → Proyectos → Editar).*`,
    `### Pendientes (${open.length})\n${open.length ? open.map(line).join("\n") : "*Nada pendiente.*"}`,
    `### Hechas (${done.length})\n${done.length ? done.map(line).join("\n") : "*Todavía ninguna.*"}`,
  ].join("\n\n");
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

// ---------- Tarea ----------
export async function syncProjects(db: pg.Client, opts: { dryRun?: boolean } = {}): Promise<JobResult> {
  const uid = USER_ID();
  const { rows: projects } = await db.query<Project>(
    `select id, name, description, status, created_at, craft_folder_id, craft_doc_id, craft_sync_hash
       from public.projects where user_id = $1 and not is_demo order by created_at`,
    [uid],
  );
  if (!projects.length) return { status: "skipped", items: 0, message: "sin proyectos" };

  if (!configured()) {
    const missing = projects.filter((p) => !p.craft_doc_id).length;
    if (missing && !opts.dryRun) {
      await db.query(
        "update public.projects set craft_error = 'falta la conexión de Craft para proyectos' where user_id = $1 and craft_doc_id is null and not is_demo",
        [uid],
      );
    }
    return { status: "skipped", items: 0, message: `falta CRAFT_PROJECTS_API_URL/KEY en apps/worker/.env (${missing} proyectos sin carpeta)` };
  }

  const result = { folders: 0, docs: 0, updated: 0, unchanged: 0, linked: 0, errors: [] as { project: string; error: string }[] };
  for (const p of projects) {
    try {
      // 1) Carpeta y ficha (se guardan en cuanto existen, por si falla el paso siguiente)
      if (!p.craft_folder_id) {
        if (opts.dryRun) { console.log(`crearía la carpeta «${p.name}»`); continue; }
        p.craft_folder_id = await createFolder(p.name);
        await db.query("update public.projects set craft_folder_id = $2 where id = $1", [p.id, p.craft_folder_id]);
        result.folders++;
      }
      if (!p.craft_doc_id) {
        if (opts.dryRun) { console.log(`crearía la ficha de «${p.name}»`); continue; }
        p.craft_doc_id = await createDocument(FICHA_TITLE, p.craft_folder_id);
        await db.query("update public.projects set craft_doc_id = $2 where id = $1", [p.id, p.craft_doc_id]);
        result.docs++;
      }

      // 2) Ficha al día
      const { rows: tasks } = await db.query<Task>(
        `select title, status, priority, to_char(due_date, 'YYYY-MM-DD') due_date,
                to_char(completed_at at time zone 'Europe/Madrid', 'YYYY-MM-DD') completed, notes
           from public.tasks where project_id = $1 and status <> 'cancelled'
          order by (status = 'done'), due_date nulls last, priority, position`,
        [p.id],
      );
      const md = fichaMarkdown(p, tasks);
      const digest = hash(md);
      if (digest === p.craft_sync_hash) {
        result.unchanged++;
      } else if (opts.dryRun) {
        console.log(`reescribiría la ficha de «${p.name}»:\n${md}\n`);
      } else {
        await rewriteDocument(p.craft_doc_id, md);
        await db.query("update public.projects set craft_sync_hash = $2, craft_synced_at = now(), craft_error = null where id = $1", [p.id, digest]);
        result.updated++;
      }

      // 3) Documentos de la carpeta (menos la ficha) enlazados al proyecto en la app
      const { items: docs = [] } = await api<{ items?: { id: string }[] }>("/documents", { params: { folderId: p.craft_folder_id } });
      const others = docs.map((d) => d.id).filter((id) => id !== p.craft_doc_id);
      if (others.length && !opts.dryRun) {
        const r = await db.query(
          `insert into public.kb_links (user_id, document_id, entity_type, entity_id, created_by)
           select $1, d.id, 'project', $2, 'assistant' from public.kb_documents d
            where d.user_id = $1 and d.source = 'craft' and d.deleted_at is null and d.external_id = any($3)
           on conflict (document_id, entity_type, entity_id) do nothing`,
          [uid, p.id, others],
        );
        result.linked += r.rowCount ?? 0;
      }
    } catch (err) {
      const msg = (err as Error).message;
      result.errors.push({ project: p.name, error: msg });
      if (!opts.dryRun) await db.query("update public.projects set craft_error = $2 where id = $1", [p.id, msg.slice(0, 500)]);
    }
  }

  if (result.errors.length && result.errors.length === projects.length) {
    throw new Error(`Ningún proyecto se pudo sincronizar: ${result.errors[0].error}`);
  }
  const changed = result.folders + result.docs + result.updated + result.linked;
  return {
    items: changed,
    details: result,
    message: `${projects.length} proyectos: ${result.folders} carpetas nuevas, ${result.updated} fichas actualizadas, ${result.linked} documentos enlazados${result.errors.length ? `, ${result.errors.length} con error` : ""}`,
  };
}

/** Hay algo que hacer ya (proyecto sin carpeta o ficha)? Para lanzarlo en cada vuelta y no esperar a la hora. */
export async function pendingProjects(db: pg.Client) {
  if (!configured()) return false;
  const { rows } = await db.query(
    "select 1 from public.projects where user_id = $1 and not is_demo and craft_doc_id is null and coalesce(craft_error, '') = '' limit 1",
    [USER_ID()],
  );
  return rows.length > 0;
}

if (import.meta.main) {
  const dryRun = process.argv.includes("--dry-run");
  const r = await runJob("craft_projects", (db) => syncProjects(db, { dryRun }));
  if (!r.ok) process.exitCode = 1;
}

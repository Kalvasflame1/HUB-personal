import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowUpRight, Link2, Search, X } from "lucide-react";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, Empty, PageHeader, Pill, SkeletonGrid } from "@/components/ui";
import { relative } from "@/lib/format";
import { linkDocument, unlinkDocument } from "./actions";
import { ARTIFACTS, CRAFT_DOCS, CRAFT_FOLDERS, craftUrl, type KnowledgeLink } from "@/lib/knowledge";

export const metadata: Metadata = { title: "Conocimiento" };

const KIND_LABEL: Record<string, string> = { note: "Nota", report: "Informe", daily_note: "Nota diaria", collection: "Colección" };

function Links({ items, external }: { items: KnowledgeLink[]; external?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((d) => (
        <li key={d.href}>
          <a href={d.href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="press flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">{d.title}</p>
              <p className="truncate text-[12px] text-ink-3">{d.note}</p>
            </div>
            <ArrowUpRight size={16} className="shrink-0 text-ink-3" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function ConocimientoPage({ searchParams }: PageProps<"/conocimiento">) {
  const query = searchParams.then((p) => (typeof p.q === "string" ? p.q.trim().slice(0, 200) : ""));
  return (
    <>
      <PageHeader title="Conocimiento" subtitle="Busca en tus documentos de Craft. Craft sigue siendo la fuente: cada resultado abre el original." />
      <Suspense fallback={<SkeletonGrid />}>
        <Content query={query} />
      </Suspense>
    </>
  );
}

/** Fragmento del texto alrededor de la primera palabra buscada que aparezca. */
function snippet(text: string | null, q: string, fallback: string | null) {
  if (!text) return fallback;
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const hay = norm(text);
  const words = norm(q).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
  let at = -1;
  for (const w of words) {
    at = hay.indexOf(w.slice(0, Math.max(4, w.length - 2)));
    if (at >= 0) break;
  }
  if (at < 0) return fallback;
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, at - 90)));
  const piece = text.slice(start, start + 260).trim();
  return `${start > 0 ? "… " : ""}${piece}${start + 260 < text.length ? " …" : ""}`;
}

type LinkItem = { id: string; kind: string; name: string; key: string };
type Targets = { projects: { id: string; name: string }[]; tasks: { id: string; name: string }[] };

function LinkControls({ documentId, links, targets }: { documentId: string; links: LinkItem[]; targets: Targets }) {
  const linked = new Set(links.map((l) => l.key));
  const hasTargets = targets.projects.length + targets.tasks.length > 0;
  return (
    <div className="-mt-1 flex flex-wrap items-center gap-2 pb-3">
      {links.map((l) => (
        <form key={l.id} action={unlinkDocument} className="flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2.5 pr-1 text-[12px] text-ink-2">
          <Link2 size={12} aria-hidden />
          <span className="max-w-[16rem] truncate">{l.kind}: {l.name}</span>
          <input type="hidden" name="id" value={l.id} />
          <button type="submit" aria-label={`Quitar el vínculo con ${l.name}`} className="press grid size-5 place-items-center rounded-full text-ink-3 hover:text-bad">
            <X size={12} aria-hidden />
          </button>
        </form>
      ))}
      {hasTargets ? (
        <form action={linkDocument} className="flex items-center gap-1.5">
          <input type="hidden" name="document_id" value={documentId} />
          <label htmlFor={`target-${documentId}`} className="sr-only">Vincular con una tarea o un proyecto</label>
          <select id={`target-${documentId}`} name="target" required defaultValue="" className="h-8 max-w-[14rem] rounded-lg border border-line bg-bg px-2 text-[13px] text-ink-2 outline-none focus:border-accent">
            <option value="" disabled>Vincular con…</option>
            {targets.projects.length ? (
              <optgroup label="Proyectos">
                {targets.projects.filter((p) => !linked.has(`project:${p.id}`)).map((p) => <option key={p.id} value={`project:${p.id}`}>{p.name}</option>)}
              </optgroup>
            ) : null}
            {targets.tasks.length ? (
              <optgroup label="Tareas abiertas">
                {targets.tasks.filter((t) => !linked.has(`task:${t.id}`)).map((t) => <option key={t.id} value={`task:${t.id}`}>{t.name}</option>)}
              </optgroup>
            ) : null}
          </select>
          <button type="submit" className="press h-8 rounded-lg border border-line px-2.5 text-[13px] font-medium text-ink-2 hover:border-accent hover:text-accent">
            Vincular
          </button>
        </form>
      ) : null}
    </div>
  );
}

async function Content({ query }: { query: Promise<string> }) {
  const q = await query;
  const { supabase } = await getSession();
  const [resultsRes, countsRes, jobRes] = await Promise.all([
    q
      ? supabase
          .from("kb_documents")
          .select("id,external_id,title,folder_path,doc_kind,excerpt,search_text,source_updated_at,source_url")
          .is("deleted_at", null)
          .textSearch("fts", q, { type: "websearch", config: "spanish" })
          .order("source_updated_at", { ascending: false, nullsFirst: false })
          .limit(30)
      : Promise.resolve({ data: null }),
    supabase.from("kb_documents").select("folder_path").is("deleted_at", null).limit(5000),
    supabase.from("job_runs").select("started_at,status,items").eq("job_name", "craft_index").order("started_at", { ascending: false }).limit(1),
  ]);
  const results = resultsRes.data;
  const indexed = countsRes.data ?? [];
  const lastRun = jobRes.data?.[0];

  // Vínculos de los resultados y destinos posibles (proyectos activos y tareas abiertas)
  const linksByDoc = new Map<string, LinkItem[]>();
  let targets: Targets = { projects: [], tasks: [] };
  if (results?.length) {
    const [linksRes, projectsRes, tasksRes] = await Promise.all([
      supabase.from("kb_links").select("id,document_id,entity_type,entity_id").in("document_id", results.map((r) => r.id)),
      supabase.from("projects").select("id,name").eq("status", "active").order("name"),
      supabase.from("tasks").select("id,title,status").in("status", ["todo", "doing"]).order("title").limit(200),
    ]);
    targets = { projects: projectsRes.data ?? [], tasks: (tasksRes.data ?? []).map((t) => ({ id: t.id, name: t.title })) };
    const names = new Map<string, string>([...targets.projects.map((p) => [`project:${p.id}`, p.name] as const), ...targets.tasks.map((t) => [`task:${t.id}`, t.name] as const)]);
    // Tareas ya cerradas que sigan vinculadas: se busca su título aparte
    const missing = (linksRes.data ?? []).filter((l) => !names.has(`${l.entity_type}:${l.entity_id}`) && l.entity_type === "task").map((l) => l.entity_id);
    if (missing.length) {
      const { data } = await supabase.from("tasks").select("id,title").in("id", missing);
      for (const t of data ?? []) names.set(`task:${t.id}`, t.title);
    }
    for (const l of linksRes.data ?? []) {
      const key = `${l.entity_type}:${l.entity_id}`;
      const name = names.get(key);
      if (!name) continue;
      const list = linksByDoc.get(l.document_id) ?? [];
      list.push({ id: l.id, kind: l.entity_type === "project" ? "Proyecto" : "Tarea", name, key });
      linksByDoc.set(l.document_id, list);
    }
  }

  // Recuento por carpeta de primer nivel, a partir del índice (o del inventario inicial si aún está vacío)
  const byFolder = new Map<string, number>();
  for (const d of indexed) {
    const top = (d.folder_path ?? "Sin carpeta").split(" / ")[0];
    byFolder.set(top, (byFolder.get(top) ?? 0) + 1);
  }
  const folders = indexed.length
    ? [...byFolder].map(([name, count]) => ({ name, count, kind: "" })).sort((a, b) => b.count - a.count)
    : CRAFT_FOLDERS;
  const total = folders.reduce((s, f) => s + f.count, 0);

  return (
    <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
      <Card className="lg:col-span-6">
        <form action="/conocimiento" className="flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">Buscar en Craft</label>
          <input
            id="q" name="q" type="search" defaultValue={q} placeholder="Buscar en Craft: ITV, seguro, Conil…" autoComplete="off" enterKeyHint="search"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-[16px] outline-none focus:border-accent"
          />
          <button type="submit" className="press flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-[15px] font-semibold text-white">
            <Search size={17} strokeWidth={2.4} aria-hidden /> Buscar
          </button>
        </form>
        <p className="mt-2 text-[12px] text-ink-3">
          {indexed.length
            ? `${indexed.length} documentos indexados${lastRun ? ` · última revisión ${relative(lastRun.started_at)}` : ""}. Los informes de noticias solo se buscan por título y extracto.`
            : "El índice aún está vacío: el Mac mini lo crea en su próxima revisión."}
        </p>

        {results ? (
          results.length === 0 ? (
            <div className="mt-4"><Empty title="Sin resultados" hint="Prueba con otra palabra o con menos palabras." /></div>
          ) : (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {results.map((d) => (
                <li key={d.id}>
                  <a href={d.source_url ?? craftUrl(d.external_id)} className="press flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[16px] font-medium leading-snug">{d.title}</p>
                      {(() => {
                        const s = snippet(d.search_text, q, d.excerpt);
                        return s ? <p className="mt-0.5 line-clamp-3 text-[14px] text-ink-2">{s}</p> : null;
                      })()}
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3">
                        <span>{d.folder_path ?? "Sin carpeta"}</span>
                        {d.doc_kind ? <Pill>{KIND_LABEL[d.doc_kind] ?? d.doc_kind}</Pill> : null}
                        {d.source_updated_at ? <span>modificado {relative(d.source_updated_at)}</span> : null}
                      </p>
                    </div>
                    <ArrowUpRight size={16} className="mt-1 shrink-0 text-ink-3" aria-hidden />
                  </a>
                  <LinkControls documentId={d.id} links={linksByDoc.get(d.id) ?? []} targets={targets} />
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Card>

      <Card className="lg:col-span-3">
        <CardTitle>Documentos de Craft</CardTitle>
        <Links items={CRAFT_DOCS} />
        <p className="mt-3 text-[12px] text-ink-3">Se abren en la app de Craft de este dispositivo.</p>
      </Card>
      <Card className="lg:col-span-3">
        <CardTitle>Artefactos de Claude</CardTitle>
        <Links items={ARTIFACTS} external />
      </Card>
      <Card className="lg:col-span-6">
        <CardTitle>Qué hay en el índice</CardTitle>
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
          {folders.map((f) => (
            <div key={f.name}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-[14px] font-medium">{f.name}</p>
                <p className="tnum shrink-0 text-[13px] text-ink-2">{f.count}</p>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-ink-3/60" style={{ width: `${Math.max(2, (f.count / Math.max(1, total)) * 100)}%` }} />
              </div>
              {f.kind ? <p className="mt-1 text-[12px] text-ink-3">{f.kind}</p> : null}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-ink-3">Fuera del índice: plantillas de ejemplo, «How to use Craft» y NOTION. El Mac mini lo revisa cada hora en solo lectura.</p>
      </Card>
    </div>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowUpRight, Plus, Star, Trash2 } from "lucide-react";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, DemoBadge, Empty, PageHeader, SkeletonGrid } from "@/components/ui";
import { relative } from "@/lib/format";
import { addSource, deleteSource, toggleFavorite } from "./actions";

export const metadata: Metadata = { title: "Información web" };

export default function WebPage() {
  return (
    <>
      <PageHeader title="Información web" subtitle="Favoritos, fuentes y lecturas recientes." />
      <Suspense fallback={<SkeletonGrid />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const { supabase } = await getSession();
  const [sourcesRes, itemsRes] = await Promise.all([
    supabase.from("web_sources").select("id,name,url,category,kind,is_favorite,is_demo").order("is_favorite", { ascending: false }).order("name"),
    supabase.from("web_items").select("id,title,url,excerpt,published_at,source_id,is_demo").order("published_at", { ascending: false }).limit(12),
  ]);
  const sources = sourcesRes.data ?? [];
  const items = itemsRes.data ?? [];
  const sourceName = new Map(sources.map((s) => [s.id, s.name]));
  const categories = [...new Set(sources.map((s) => s.category ?? "Sin categoría"))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
      <Card className="lg:col-span-4">
        <CardTitle action={<DemoBadge show={items.some((i) => i.is_demo)} />}>Lecturas recientes</CardTitle>
        {items.length === 0 ? (
          <Empty title="Sin lecturas todavía" hint="La recogida periódica de fuentes llega en la Fase 4." />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="py-3 first:pt-0">
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="press block">
                  <p className="text-[16px] font-medium leading-snug">{i.title}</p>
                  {i.excerpt ? <p className="mt-0.5 text-[14px] text-ink-2">{i.excerpt}</p> : null}
                  <p className="mt-1 text-[12px] text-ink-3">
                    {sourceName.get(i.source_id) ?? "Fuente"}{i.published_at ? ` · ${relative(i.published_at)}` : ""}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle action={<DemoBadge show={sources.some((s) => s.is_demo)} />}>Fuentes y favoritos</CardTitle>
        <form action={addSource} className="mb-5 flex flex-col gap-3 border-b border-line pb-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-[12px] font-medium text-ink-3">Nombre</label>
            <input id="name" name="name" required maxLength={120} autoComplete="off" className="h-11 rounded-xl border border-line bg-bg px-3 text-[16px] outline-none focus:border-accent" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="url" className="text-[12px] font-medium text-ink-3">Dirección</label>
            <input id="url" name="url" required inputMode="url" autoCapitalize="none" autoComplete="off" placeholder="ejemplo.com" className="h-11 rounded-xl border border-line bg-bg px-3 text-[16px] outline-none focus:border-accent" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="category" className="text-[12px] font-medium text-ink-3">Categoría</label>
            <input id="category" name="category" maxLength={60} list="categories" autoComplete="off" className="h-11 rounded-xl border border-line bg-bg px-3 text-[16px] outline-none focus:border-accent" />
            <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <button type="submit" className="press flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent text-[15px] font-semibold text-white">
            <Plus size={17} strokeWidth={2.4} aria-hidden /> Añadir
          </button>
        </form>

        {sources.length === 0 ? (
          <Empty title="Sin fuentes" />
        ) : (
          categories.map((c) => (
            <div key={c} className="mb-4 last:mb-0">
              <p className="mb-1 text-[13px] font-semibold text-ink-2">{c}</p>
              <ul className="divide-y divide-line">
                {sources.filter((s) => (s.category ?? "Sin categoría") === c).map((s) => (
                  <li key={s.id} className="flex items-center gap-1 py-2">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="press flex min-w-0 flex-1 items-center gap-1.5 text-[15px]">
                      <span className="truncate">{s.name}</span>
                      <ArrowUpRight size={14} className="shrink-0 text-ink-3" aria-hidden />
                    </a>
                    <form action={toggleFavorite}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="favorite" value={String(!s.is_favorite)} />
                      <button type="submit" aria-label={s.is_favorite ? "Quitar de favoritos" : "Marcar como favorito"} aria-pressed={s.is_favorite}
                        className={`press grid size-8 place-items-center rounded-lg hover:bg-surface-2 ${s.is_favorite ? "text-accent" : "text-ink-3"}`}>
                        <Star size={16} fill={s.is_favorite ? "currentColor" : "none"} aria-hidden />
                      </button>
                    </form>
                    <form action={deleteSource}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" aria-label={`Eliminar ${s.name}`} className="press grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-bad">
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

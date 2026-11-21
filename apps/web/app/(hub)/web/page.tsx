import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowUpRight, Bookmark, Check, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, DemoBadge, Empty, PageHeader, Pill, SkeletonGrid } from "@/components/ui";
import { dayShort, relative, todayISO } from "@/lib/format";
import { AiText, type AiSource } from "@/components/ai-text";
import { MODELS } from "@/lib/assistant-settings";
import { addSource, deleteSource, setItemFlag, toggleFavorite } from "./actions";

export const metadata: Metadata = { title: "Información web" };

export default function WebPage() {
  return (
    <>
      <PageHeader title="Información web" subtitle="Resumen del día, lecturas recientes, favoritos y fuentes." />
      <Suspense fallback={<SkeletonGrid />}>
        <Content />
      </Suspense>
    </>
  );
}

type Item = { id: string; title: string; url: string; excerpt: string | null; published_at: string | null; is_read: boolean; is_saved: boolean };

function FlagButton({ id, field, on, labelOn, labelOff, children }: { id: string; field: "is_saved" | "is_read"; on: boolean; labelOn: string; labelOff: string; children: React.ReactNode }) {
  return (
    <form action={setItemFlag}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(!on)} />
      <button type="submit" aria-label={on ? labelOn : labelOff} aria-pressed={on}
        className={`press grid size-8 place-items-center rounded-lg hover:bg-surface-2 ${on ? "text-accent" : "text-ink-3"}`}>
        {children}
      </button>
    </form>
  );
}

function ItemRow({ item: i, source }: { item: Item; source?: string }) {
  return (
    <li className="flex items-start gap-2 py-3 first:pt-0">
      <a href={i.url} target="_blank" rel="noopener noreferrer" className={`press block min-w-0 flex-1 ${i.is_read ? "opacity-60" : ""}`}>
        <p className="text-[16px] font-medium leading-snug">{i.title}</p>
        {i.excerpt ? <p className="mt-0.5 text-[14px] text-ink-2">{i.excerpt}</p> : null}
        <p className="mt-1 text-[12px] text-ink-3">
          {source ?? "Fuente"}{i.published_at ? ` · ${relative(i.published_at)}` : ""}
        </p>
      </a>
      <div className="flex shrink-0 flex-col">
        <FlagButton id={i.id} field="is_saved" on={i.is_saved} labelOn="Quitar de guardadas" labelOff="Guardar">
          <Bookmark size={16} fill={i.is_saved ? "currentColor" : "none"} aria-hidden />
        </FlagButton>
        <FlagButton id={i.id} field="is_read" on={i.is_read} labelOn="Marcar como no leída" labelOff="Marcar como leída">
          <Check size={16} strokeWidth={i.is_read ? 3 : 2} aria-hidden />
        </FlagButton>
      </div>
    </li>
  );
}

async function Content() {
  const { supabase } = await getSession();
  const [sourcesRes, itemsRes, savedRes, digestRes] = await Promise.all([
    supabase.from("web_sources").select("id,name,url,category,kind,fetch_enabled,is_favorite,is_demo").order("is_favorite", { ascending: false }).order("name"),
    supabase.from("web_items").select("id,title,url,excerpt,published_at,source_id,is_demo,is_read,is_saved").order("published_at", { ascending: false }).limit(12),
    supabase.from("web_items").select("id,title,url,excerpt,published_at,source_id,is_demo,is_read,is_saved").eq("is_saved", true).order("published_at", { ascending: false }).limit(50),
    supabase.from("web_digests").select("digest_date,body,items,model").order("digest_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const digest = digestRes.data;
  const digestItems = (digest?.items ?? []) as { n: number; title: string; url: string; source: string }[];
  const digestSources: AiSource[] = digestItems.map((d) => ({ n: d.n, label: `${d.source}: ${d.title}`, href: d.url }));
  const sources = sourcesRes.data ?? [];
  const items = itemsRes.data ?? [];
  const saved = savedRes.data ?? [];
  const sourceName = new Map(sources.map((s) => [s.id, s.name]));
  const categories = [...new Set(sources.map((s) => s.category ?? "Sin categoría"))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
      {digest ? (
        <Card className="lg:col-span-4">
          <CardTitle action={<span className="text-[12px] text-ink-3">{digest.digest_date === todayISO() ? "hoy" : dayShort(digest.digest_date)}</span>}>Resumen de tus fuentes</CardTitle>
          <AiText text={digest.body} sources={digestSources} />
          {digestItems.length ? (
            <details className="mt-3 border-t border-line pt-3">
              <summary className="press cursor-pointer text-[13px] font-medium text-accent">Noticias citadas ({digestItems.length})</summary>
              <ul className="mt-2 flex flex-col gap-1.5">
                {digestItems.map((d) => (
                  <li key={d.n} className="flex gap-2 text-[13px]">
                    <span className="tnum w-5 shrink-0 text-right font-semibold text-accent">{d.n}</span>
                    <a href={d.url} target="_blank" rel="noreferrer" className="min-w-0 text-ink-2 hover:text-accent"><span className="text-ink-3">{d.source} · </span>{d.title}</a>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-3">
            <Sparkles size={13} className="text-accent" aria-hidden />
            Redactado por Claude {MODELS.find((m) => m.value === digest.model)?.label ?? digest.model} con las noticias de las últimas 24 horas; se renueva cada mañana a las 07:30
          </p>
        </Card>
      ) : null}

      <Card className="lg:col-span-4">
        <CardTitle action={<DemoBadge show={items.some((i) => i.is_demo)} />}>Lecturas recientes</CardTitle>
        {items.length === 0 ? (
          <Empty title="Sin lecturas todavía" hint="Añade una web con RSS y el Mac mini recogerá sus novedades cada dos horas." />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((i) => <ItemRow key={i.id} item={i} source={sourceName.get(i.source_id)} />)}
          </ul>
        )}
      </Card>

      {saved.length ? (
        <Card className="lg:col-span-4 lg:order-last">
          <CardTitle>Guardadas <span className="tnum font-normal text-ink-3">{saved.length}</span></CardTitle>
          <ul className="divide-y divide-line">
            {saved.map((i) => <ItemRow key={i.id} item={i} source={sourceName.get(i.source_id)} />)}
          </ul>
          <p className="mt-3 text-[12px] text-ink-3">La limpieza semanal nunca borra las lecturas guardadas.</p>
        </Card>
      ) : null}

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
          <p className="text-[12px] leading-relaxed text-ink-3">Si la web publica RSS, el Mac mini lo detecta y recoge sus novedades cada dos horas.</p>
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
                      {s.kind === "feed" && s.fetch_enabled ? <Pill>RSS</Pill> : null}
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

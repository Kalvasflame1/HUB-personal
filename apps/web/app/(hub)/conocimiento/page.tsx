import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { Card, CardTitle, PageHeader, Pill } from "@/components/ui";
import { ARTIFACTS, CRAFT_DOCS, CRAFT_FOLDERS, type KnowledgeLink } from "@/lib/knowledge";

export const metadata: Metadata = { title: "Conocimiento" };

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

export default function ConocimientoPage() {
  const total = CRAFT_FOLDERS.reduce((s, f) => s + f.count, 0);
  return (
    <>
      <PageHeader title="Conocimiento" subtitle="Craft sigue siendo la fuente. Aquí están los accesos directos.">
        <Pill>Búsqueda en la Fase 4</Pill>
      </PageHeader>
      <div className="rise grid grid-cols-1 gap-4 md:grid-cols-6">
        <Card className="md:col-span-3">
          <CardTitle>Documentos de Craft</CardTitle>
          <Links items={CRAFT_DOCS} />
          <p className="mt-3 text-[12px] text-ink-3">Se abren en la app de Craft de este dispositivo.</p>
        </Card>
        <Card className="md:col-span-3">
          <CardTitle>Artefactos de Claude</CardTitle>
          <Links items={ARTIFACTS} external />
        </Card>
        <Card className="md:col-span-6">
          <CardTitle>Qué hay en Craft</CardTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
            {CRAFT_FOLDERS.map((f) => (
              <div key={f.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[14px] font-medium">{f.name}</p>
                  <p className="tnum shrink-0 text-[13px] text-ink-2">{f.count}</p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-ink-3/60" style={{ width: `${Math.max(2, (f.count / total) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[12px] text-ink-3">{f.kind}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-ink-3">Inventario del 16 de noviembre de 2026. Se actualizará solo cuando el índice esté activo.</p>
        </Card>
      </div>
    </>
  );
}

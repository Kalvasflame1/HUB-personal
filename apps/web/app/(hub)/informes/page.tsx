import { Suspense } from "react";
import type { Metadata } from "next";
import { getSession } from "@/lib/supabase/server";
import { Card, DemoBadge, Empty, PageHeader, Pill, SkeletonGrid } from "@/components/ui";
import { dayShort } from "@/lib/format";

export const metadata: Metadata = { title: "Informes" };

export default function InformesPage() {
  return (
    <>
      <PageHeader title="Informes" subtitle="Resúmenes diarios, semanales y mensuales." />
      <Suspense fallback={<SkeletonGrid blocks={3} />}>
        <Content />
      </Suspense>
    </>
  );
}

const KIND: Record<string, string> = { daily: "Diario", weekly: "Semanal", monthly: "Mensual" };

/** Markdown mínimo: títulos "## " y listas "- ". Suficiente para los informes de plantilla. */
function Body({ md }: { md: string }) {
  const lines = md.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  const paragraphs = lines.filter((l) => !l.startsWith("- ") && !l.startsWith("#"));
  return (
    <>
      {paragraphs.map((p, i) => <p key={i} className="text-[15px] leading-relaxed text-ink-2">{p}</p>)}
      {bullets.length ? (
        <ul className="flex flex-col gap-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-ink-2">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />
              {b}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

async function Content() {
  const { supabase } = await getSession();
  const { data } = await supabase.from("reports").select("id,kind,title,period_start,period_end,body_md,generated_by,is_demo").order("period_end", { ascending: false }).limit(30);
  const reports = data ?? [];
  if (reports.length === 0) {
    return <Empty title="Aún no hay informes" hint="Se generarán automáticamente cuando el Mac mini esté configurado (Fase 4)." />;
  }
  return (
    <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
      {reports.map((r, i) => (
        <Card key={r.id} className={i === 0 ? "lg:col-span-6" : "lg:col-span-3"}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Pill tone="accent">{KIND[r.kind] ?? r.kind}</Pill>
            <span className="text-[12px] text-ink-3">
              {r.period_start === r.period_end ? dayShort(r.period_start) : `${dayShort(r.period_start)} – ${dayShort(r.period_end)}`}
            </span>
            <DemoBadge show={r.is_demo} />
          </div>
          <h2 className="mb-2 text-[20px] font-semibold tracking-tight">{r.title}</h2>
          {r.body_md ? <Body md={r.body_md} /> : <p className="text-[14px] text-ink-3">Sin contenido.</p>}
        </Card>
      ))}
    </div>
  );
}

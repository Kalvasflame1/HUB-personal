import { Suspense } from "react";
import type { Metadata } from "next";
import { getSession } from "@/lib/supabase/server";
import { Card, DemoBadge, Empty, PageHeader, Pill, SkeletonGrid } from "@/components/ui";
import { Sparkles } from "lucide-react";
import { dayShort } from "@/lib/format";
import { AiText } from "@/components/ai-text";
import { MODELS } from "@/lib/assistant-settings";

export const metadata: Metadata = { title: "Informes" };

export default function InformesPage() {
  return (
    <>
      <PageHeader title="Informes" subtitle="Resúmenes diarios, semanales y mensuales. Las cifras salen de consultas; el comentario de los semanales y mensuales lo redacta Claude." />
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
  const { data } = await supabase.from("reports").select("id,kind,title,period_start,period_end,body_md,generated_by,is_demo,ai_summary,ai_model").order("period_end", { ascending: false }).limit(30);
  const reports = data ?? [];
  if (reports.length === 0) {
    return <Empty title="Aún no hay informes" hint="El Mac mini los genera cada mañana: el diario a las 06:30, el semanal los lunes y el mensual el día 1." />;
  }
  // Arriba, el último semanal y el último mensual (los que llevan comentario); debajo, el resto por fecha.
  const featured = (["weekly", "monthly"] as const).map((k) => reports.find((r) => r.kind === k)).filter((r) => r != null);
  const ordered = [...featured, ...reports.filter((r) => !featured.includes(r))];
  return (
    <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
      {ordered.map((r, i) => (
        <Card key={r.id} className={i < featured.length && featured.length === 1 ? "lg:col-span-6" : "lg:col-span-3"}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Pill tone="accent">{KIND[r.kind] ?? r.kind}</Pill>
            <span className="text-[12px] text-ink-3">
              {r.period_start === r.period_end ? dayShort(r.period_start) : `${dayShort(r.period_start)} – ${dayShort(r.period_end)}`}
            </span>
            <DemoBadge show={r.is_demo} />
          </div>
          <h2 className="mb-2 text-[20px] font-semibold tracking-tight">{r.title}</h2>
          {r.ai_summary ? (
            <div className="mb-4">
              <AiText text={r.ai_summary} sources={[]} />
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-3">
                <Sparkles size={13} className="text-accent" aria-hidden />
                Comentario de Claude {MODELS.find((m) => m.value === r.ai_model)?.label ?? r.ai_model}, sobre las cifras de abajo
              </p>
            </div>
          ) : null}
          {r.body_md ? (
            <div className={r.ai_summary ? "flex flex-col gap-2 border-t border-line pt-3" : "flex flex-col gap-2"}>
              {r.ai_summary ? <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">Cifras</p> : null}
              <Body md={r.body_md} />
            </div>
          ) : <p className="text-[14px] text-ink-3">Sin contenido.</p>}
        </Card>
      ))}
    </div>
  );
}

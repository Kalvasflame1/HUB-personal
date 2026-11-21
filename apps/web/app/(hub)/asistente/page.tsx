import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUp, BookOpen, Cpu, Database, Loader2, Search, Settings, Sparkles } from "lucide-react";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, PageHeader, SkeletonGrid } from "@/components/ui";
import { answer, SUGGESTIONS, type Answer } from "@/lib/quick-answers";
import { loadSettings, MODELS } from "@/lib/assistant-settings";
import { AutoRefresh } from "@/components/ai-answer";
import { AiText, type AiSource } from "@/components/ai-text";
import { askAi } from "./actions";

export const metadata: Metadata = { title: "Asistente" };

const SOURCES = [
  { icon: Database, title: "Datos del Hub", text: "Tareas, entrenamientos, forma y eventos guardados en Supabase. Cada cifra sale de una consulta, no de una IA." },
  { icon: BookOpen, title: "Craft", text: "Búsqueda en el índice, Seguimiento activo e Informe Diario." },
  { icon: Cpu, title: "Claude en el Mac mini", text: "Lo que las consultas no saben responder se lo pregunta a Claude con tu suscripción, con tope diario. Solo recibe lo que el worker le pasa y no puede cambiar nada." },
];

export default function AsistentePage({ searchParams }: PageProps<"/asistente">) {
  const params = searchParams.then((p) => ({
    q: typeof p.q === "string" ? p.q.trim().slice(0, 300) : "",
    job: typeof p.job === "string" && /^[0-9a-f-]{36}$/.test(p.job) ? p.job : "",
    failed: p.ia === "error",
  }));
  return (
    <>
      <PageHeader title="Asistente" subtitle="Preguntas sobre tus datos: las rápidas con consultas y el resto con Claude.">
        <div className="flex items-center gap-3">
          <Link href="/asistente/configuracion" className="press flex items-center gap-1 text-[14px] font-medium text-accent">
            <Settings size={16} aria-hidden /> Configuración
          </Link>
        </div>
      </PageHeader>
      <Suspense fallback={<SkeletonGrid blocks={2} />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

function AnswerCard({ a }: { a: Answer }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-[13px] font-medium text-ink-3">{a.title}</p>
      {a.headline ? (
        <p className="tnum mt-1 text-[40px] font-semibold leading-none tracking-tight">
          {a.headline}{a.unit ? <span className="ml-1 text-[15px] font-medium text-ink-3">{a.unit}</span> : null}
        </p>
      ) : null}
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{a.summary}</p>
      {a.rows?.length ? (
        <ul className="mt-3 divide-y divide-line">
          {a.rows.map((r, i) => {
            const body = (
              <div className="flex items-baseline justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className={`text-[14px] leading-snug ${r.strong ? "font-semibold text-ink" : ""}`}>{r.label}</p>
                  {r.hint ? <p className="truncate text-[12px] text-ink-3">{r.hint}</p> : null}
                </div>
                {r.value ? <p className="tnum max-w-[60%] shrink-0 text-right text-[14px] text-ink-2">{r.value}</p> : null}
              </div>
            );
            return <li key={i}>{r.href ? <a href={r.href} className="press block hover:text-accent">{body}</a> : body}</li>;
          })}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-[12px] text-ink-3">Fuente: {a.source}</p>
        {a.href ? <Link href={a.href} className="text-[13px] font-medium text-accent">{a.hrefLabel ?? "Ver más"}</Link> : null}
      </div>
    </div>
  );
}

function AskButton({ q, primary }: { q: string; primary?: boolean }) {
  return (
    <form action={askAi}>
      <input type="hidden" name="q" value={q} />
      <button type="submit" className={primary
        ? "press inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-[14px] font-semibold text-white"
        : "press inline-flex items-center gap-1.5 text-[14px] font-medium text-accent"}>
        <Sparkles size={15} aria-hidden /> Preguntar a Claude
      </button>
    </form>
  );
}

type Job = { status: string; output: unknown; error: string | null; model: string | null; usage: unknown };

function AiCard({ job, q }: { job: Job | null; q: string }) {
  if (!job) return <div className="rounded-2xl border border-line p-4 text-[14px] text-ink-2">No encuentro esa pregunta. Vuelve a enviarla.</div>;
  const pending = job.status === "queued" || job.status === "running";
  const out = (job.output ?? {}) as { answer?: string; sources?: AiSource[] };
  const usage = (job.usage ?? {}) as { duration_ms?: number };
  const model = MODELS.find((m) => m.value === job.model)?.label ?? job.model;
  return (
    <div className="rounded-2xl border border-line p-4" aria-live="polite">
      <AutoRefresh active={pending} />
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-3"><Sparkles size={14} className="text-accent" aria-hidden /> Claude</p>
      {pending ? (
        <p className="flex items-center gap-2 text-[15px] text-ink-2">
          <Loader2 size={16} className="animate-spin text-accent" aria-hidden />
          {job.status === "queued" ? "Enviada al Mac mini…" : "Reuniendo tus datos y pensando…"}
        </p>
      ) : job.status === "done" && out.answer ? (
        <>
          <AiText text={out.answer} sources={out.sources ?? []} />
          {out.sources?.length ? (
            <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
              {out.sources.map((s) => (
                <li key={s.n} className="flex gap-2 text-[13px]">
                  <span className="tnum w-4 shrink-0 text-right font-semibold text-accent">{s.n}</span>
                  {s.href ? <a href={s.href} className="min-w-0 truncate text-ink-2 hover:text-accent">{s.label}</a> : <span className="min-w-0 truncate text-ink-2">{s.label}</span>}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-[12px] text-ink-3">
            {[model, usage.duration_ms ? `${(usage.duration_ms / 1000).toFixed(1).replace(".", ",")} s` : null, "solo lectura: Claude no ha cambiado nada"].filter(Boolean).join(" · ")}
          </p>
        </>
      ) : (
        <>
          <p className="text-[15px] text-ink-2">{job.error ?? "No se pudo responder."}</p>
          <div className="mt-3"><AskButton q={q} /></div>
        </>
      )}
    </div>
  );
}

async function Content({ params }: { params: Promise<{ q: string; job: string; failed: boolean }> }) {
  const { q, job: jobId, failed } = await params;
  const { supabase } = await getSession();
  const [result, settings, jobRes] = await Promise.all([
    q && !jobId ? answer(supabase, q) : null,
    loadSettings(supabase),
    jobId ? supabase.from("ai_jobs").select("status,output,error,model,usage").eq("id", jobId).maybeSingle() : null,
  ]);
  const job = (jobRes?.data ?? null) as Job | null;

  return (
    <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
      <Card className="flex flex-col lg:col-span-4">
        <form action="/asistente" className="flex items-center gap-2 rounded-2xl border border-line bg-bg p-2 pl-4 focus-within:border-accent">
          <label htmlFor="q" className="sr-only">Pregunta</label>
          <input id="q" name="q" defaultValue={q} placeholder="Escribe una pregunta" autoComplete="off" maxLength={300}
            className="h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
          <button type="submit" aria-label="Preguntar" className="press grid size-10 place-items-center rounded-xl bg-accent text-white">
            <ArrowUp size={18} strokeWidth={2.4} aria-hidden />
          </button>
        </form>

        {q ? (
          <div className="mt-4">
            {jobId ? (
              <AiCard job={job} q={q} />
            ) : result ? (
              <>
                <AnswerCard a={result} />
                <div className="mt-2 flex justify-end"><AskButton q={q} /></div>
              </>
            ) : (
              <div className="rounded-2xl border border-line p-4">
                <p className="text-[15px] font-medium">Esta no la sé responder con una consulta.</p>
                <p className="mt-1 text-[14px] text-ink-2">{failed ? "No se pudo enviar la pregunta a Claude. Inténtalo de nuevo." : "Se la puedo preguntar a Claude con tus datos, o puedes buscarla en Craft."}</p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <AskButton q={q} primary />
                  <Link href={`/conocimiento?q=${encodeURIComponent(q)}`} className="press inline-flex items-center gap-1.5 text-[14px] font-medium text-accent">
                    <Search size={15} aria-hidden /> Buscar en Craft
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {settings.shortcuts.length ? (
          <>
            <p className="mb-2 mt-5 text-[13px] font-semibold text-ink-2">Tus atajos</p>
            <div className="flex flex-wrap gap-2">
              {settings.shortcuts.map((s) => (
                <Link key={s} href={`/asistente?q=${encodeURIComponent(s)}`}
                  className={`press rounded-full border px-3 py-1.5 text-[14px] ${s === q ? "border-accent bg-accent-soft text-accent" : "border-accent/40 text-ink hover:border-accent"}`}>
                  {s}
                </Link>
              ))}
            </div>
          </>
        ) : null}

        <p className="mb-2 mt-5 text-[13px] font-semibold text-ink-2">Preguntas que ya sé responder</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Link key={s} href={`/asistente?q=${encodeURIComponent(s)}`}
              className={`press rounded-full border px-3 py-1.5 text-[14px] ${s === q ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2 hover:border-accent"}`}>
              {s}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-ink-3">Puedes escribirlas a tu manera: «km esta semana», «¿cómo voy de forma?», «busca itv»…</p>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle>De dónde responde</CardTitle>
        <ul className="flex flex-col gap-4">
          {SOURCES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <Icon size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <div>
                <p className="text-[15px] font-medium">{title}</p>
                <p className="text-[13px] leading-relaxed text-ink-3">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

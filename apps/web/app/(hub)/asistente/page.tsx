import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUp, BookOpen, Cpu, Database, Search } from "lucide-react";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, PageHeader, Pill, SkeletonGrid } from "@/components/ui";
import { answer, SUGGESTIONS, type Answer } from "@/lib/quick-answers";

export const metadata: Metadata = { title: "Asistente" };

const SOURCES = [
  { icon: Database, title: "Datos del Hub", text: "Tareas, entrenamientos, forma y eventos guardados en Supabase. Cada cifra sale de una consulta, no de una IA." },
  { icon: BookOpen, title: "Craft", text: "Búsqueda en el índice, Seguimiento activo e Informe Diario." },
  { icon: Cpu, title: "IA en el Mac mini", text: "Más adelante: preguntas libres con tu suscripción de Claude y tope diario. Lo de aquí seguirá funcionando sin ella." },
];

export default function AsistentePage({ searchParams }: PageProps<"/asistente">) {
  const question = searchParams.then((p) => (typeof p.q === "string" ? p.q.trim().slice(0, 300) : ""));
  return (
    <>
      <PageHeader title="Asistente" subtitle="Preguntas rápidas sobre tus datos, respondidas con consultas y sin IA.">
        <Pill>Sin IA</Pill>
      </PageHeader>
      <Suspense fallback={<SkeletonGrid blocks={2} />}>
        <Content question={question} />
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

async function Content({ question }: { question: Promise<string> }) {
  const q = await question;
  const { supabase } = await getSession();
  const result = q ? await answer(supabase, q) : null;

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
            {result ? (
              <AnswerCard a={result} />
            ) : (
              <div className="rounded-2xl border border-line p-4">
                <p className="text-[15px] font-medium">Esa todavía no la sé responder sin IA.</p>
                <p className="mt-1 text-[14px] text-ink-2">Prueba con una de las preguntas de abajo, o búscala en Craft.</p>
                <Link href={`/conocimiento?q=${encodeURIComponent(q)}`} className="press mt-3 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent">
                  <Search size={15} aria-hidden /> Buscar «{q}» en Craft
                </Link>
              </div>
            )}
          </div>
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

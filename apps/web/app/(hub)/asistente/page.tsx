import type { Metadata } from "next";
import { ArrowUp, Database, BookOpen, Cpu } from "lucide-react";
import { Card, CardTitle, PageHeader, Pill } from "@/components/ui";

export const metadata: Metadata = { title: "Asistente" };

const EXAMPLES = [
  "¿Cuántos kilómetros he corrido este mes?",
  "¿Cómo ha evolucionado mi ritmo?",
  "¿Qué tareas tengo pendientes?",
  "Prepara mi resumen semanal.",
  "Busca en Craft la documentación de un proyecto.",
  "Relaciona mis tareas con documentos que ya tengo.",
];

const SOURCES = [
  { icon: Database, title: "Datos del Hub", text: "Tareas, entrenamientos e informes guardados en Supabase." },
  { icon: BookOpen, title: "Craft", text: "Búsqueda en el índice y lectura del documento original." },
  { icon: Cpu, title: "Mac mini", text: "Las preguntas se procesan en casa, con tu suscripción de Claude." },
];

export default function AsistentePage() {
  return (
    <>
      <PageHeader title="Asistente" subtitle="Preguntas en lenguaje natural sobre tus datos.">
        <Pill>Disponible en la Fase 5</Pill>
      </PageHeader>
      <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
        <Card className="flex flex-col lg:col-span-4">
          <CardTitle>Qué podrás preguntar</CardTitle>
          <ul className="flex flex-col gap-2">
            {EXAMPLES.map((q) => (
              <li key={q} className="rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-ink-2">{q}</li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-line bg-bg p-2 pl-4 opacity-60">
            <label htmlFor="question" className="sr-only">Pregunta</label>
            <input id="question" disabled placeholder="Escribe una pregunta" className="h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
            <button type="button" disabled aria-label="Enviar" className="grid size-10 place-items-center rounded-xl bg-accent text-white">
              <ArrowUp size={18} strokeWidth={2.4} aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-[12px] text-ink-3">
            Todavía no está activo. Antes hay que verificar las condiciones de uso programado de la suscripción de Claude.
          </p>
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle>De dónde responderá</CardTitle>
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
    </>
  );
}

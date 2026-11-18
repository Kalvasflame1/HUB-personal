"use client";

import { useFormStatus } from "react-dom";
import { Check, FileText, Trash2 } from "lucide-react";
import { deleteTask, toggleTask } from "./actions";

function CheckButton({ done }: { done: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
      className={`press grid size-6 shrink-0 place-items-center rounded-full border ${
        done ? "border-accent bg-accent text-white" : "border-ink-3/60 text-transparent hover:border-accent"
      } ${pending ? "opacity-40" : ""}`}
    >
      <Check size={14} strokeWidth={3} aria-hidden />
    </button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label="Eliminar tarea"
      className={`press grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-bad ${pending ? "opacity-40" : ""}`}
    >
      <Trash2 size={16} aria-hidden />
    </button>
  );
}

export type DocLink = { title: string; href: string };

/** Documentos de Craft vinculados; se abren en la app de Craft. */
export function DocLinks({ docs }: { docs?: DocLink[] }) {
  if (!docs?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
      {docs.map((d) => (
        <a key={d.href} href={d.href} className="press flex min-w-0 items-center gap-1 text-[12px] text-accent">
          <FileText size={12} className="shrink-0" aria-hidden />
          <span className="truncate">{d.title}</span>
        </a>
      ))}
    </div>
  );
}

export function TaskRow({
  id, title, done, meta, badge, badgeTone, docs,
}: {
  id: string; title: string; done: boolean; meta?: string; badge?: string; badgeTone?: "bad" | "neutral"; docs?: DocLink[];
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <form action={toggleTask}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="done" value={String(!done)} />
        <CheckButton done={done} />
      </form>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] ${done ? "text-ink-3 line-through" : ""}`}>{title}</p>
        {meta ? <p className="truncate text-[12px] text-ink-3">{meta}</p> : null}
        <DocLinks docs={docs} />
      </div>
      {badge ? (
        <span className={`shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-medium ${badgeTone === "bad" ? "text-bad" : "text-ink-2"}`}>
          {badge}
        </span>
      ) : null}
      <form action={deleteTask}>
        <input type="hidden" name="id" value={id} />
        <DeleteButton />
      </form>
    </li>
  );
}

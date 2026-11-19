"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, FileText, Pencil, Trash2 } from "lucide-react";
import { deleteTask, toggleTask, updateTask } from "./actions";

const PRIORITY = ["", "Máxima", "Alta", "Media", "Baja"];
const FIELD = "h-10 w-full min-w-0 rounded-xl border border-line bg-bg px-2 text-[15px] outline-none focus:border-accent";

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

export type TaskFields = { projectId: string | null; priority: number; dueDate: string | null };
export type ProjectOption = { id: string; name: string };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`press h-10 rounded-xl bg-accent px-4 text-[14px] font-semibold text-white ${pending ? "opacity-60" : ""}`}>
      {pending ? "Guardando…" : "Guardar"}
    </button>
  );
}

function EditForm({ id, title, fields, projects, onDone }: { id: string; title: string; fields: TaskFields; projects: ProjectOption[]; onDone: () => void }) {
  return (
    <li className="py-3">
      <form
        action={async (fd) => { await updateTask(fd); onDone(); }}
        onKeyDown={(e) => { if (e.key === "Escape") onDone(); }}
        className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface-2/40 p-3"
      >
        <input type="hidden" name="id" value={id} />
        <label className="col-span-2 flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-medium text-ink-3">Tarea</span>
          <input name="title" defaultValue={title} required maxLength={200} autoFocus autoComplete="off" className={`${FIELD} px-3 text-[16px]`} />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-medium text-ink-3">Proyecto</span>
          <select name="project_id" defaultValue={fields.projectId ?? ""} className={FIELD}>
            <option value="">Ninguno</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-medium text-ink-3">Prioridad</span>
          <select name="priority" defaultValue={String(fields.priority)} className={FIELD}>
            {[1, 2, 3, 4].map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-medium text-ink-3">Fecha</span>
          <input name="due_date" type="date" defaultValue={fields.dueDate ?? ""} className={FIELD} />
        </label>
        <div className="flex items-end justify-end gap-2">
          <button type="button" onClick={onDone} className="press h-10 rounded-xl border border-line px-4 text-[14px] font-medium text-ink-2">Cancelar</button>
          <SaveButton />
        </div>
      </form>
    </li>
  );
}

export function TaskRow({
  id, title, done, meta, badge, badgeTone, docs, fields, projects = [],
}: {
  id: string; title: string; done: boolean; meta?: string; badge?: string; badgeTone?: "bad" | "neutral"; docs?: DocLink[];
  fields?: TaskFields; projects?: ProjectOption[];
}) {
  const [editing, setEditing] = useState(false);
  if (editing && fields) return <EditForm id={id} title={title} fields={fields} projects={projects} onDone={() => setEditing(false)} />;
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
      {fields ? (
        <button type="button" onClick={() => setEditing(true)} aria-label={`Editar ${title}`}
          className="press -mr-2 grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
          <Pencil size={16} aria-hidden />
        </button>
      ) : null}
      <form action={deleteTask}>
        <input type="hidden" name="id" value={id} />
        <DeleteButton />
      </form>
    </li>
  );
}

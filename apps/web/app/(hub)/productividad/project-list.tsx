"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { FolderOpen, MoreHorizontal, Plus } from "lucide-react";
import { createProject, setProjectStatus, updateProject } from "./actions";
import { DocLinks, type DocLink } from "./task-row";

const FIELD = "w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-[15px] outline-none focus:border-accent";

export type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  closed: number;
  total: number;
  craftHref: string | null;   // «Ficha del proyecto» en Craft, si ya existe
  craftError: string | null;
  docs?: DocLink[];
};

function Submit({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} ${pending ? "opacity-60" : ""}`}>
      {children}
    </button>
  );
}

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setProjectStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Submit className="press h-9 rounded-xl border border-line px-3 text-[13px] font-medium text-ink-2">{label}</Submit>
    </form>
  );
}

function ProjectRow({ p }: { p: ProjectItem }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const pct = p.total ? Math.round((p.closed / p.total) * 100) : 0;

  return (
    <li>
      <div className="flex items-center justify-between gap-2">
        <p className={`truncate text-[15px] font-medium ${p.status === "paused" ? "text-ink-3" : ""}`}>
          {p.name}
          {p.status === "paused" ? <span className="ml-1.5 text-[12px] font-normal text-ink-3">· Pausado</span> : null}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <p className="tnum text-[12px] text-ink-3">{p.closed}/{p.total}</p>
          <button type="button" onClick={() => { setOpen((o) => !o); setEditing(false); }} aria-label={`Opciones de ${p.name}`} aria-expanded={open}
            className="press -mr-2 grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
            <MoreHorizontal size={16} aria-hidden />
          </button>
        </div>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${pct}% completado`}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {p.craftHref ? (
          <a href={p.craftHref} className="press flex items-center gap-1 text-[12px] text-accent">
            <FolderOpen size={12} aria-hidden /> Ficha en Craft
          </a>
        ) : (
          <span className="text-[12px] text-ink-3">{p.craftError ? "Craft: pendiente de conexión" : "Creando carpeta en Craft…"}</span>
        )}
      </div>
      <DocLinks docs={p.docs} />

      {open ? (
        <div className="mt-2 rounded-xl border border-line bg-surface-2/40 p-3">
          {editing ? (
            <form action={async (fd) => { await updateProject(fd); setEditing(false); }} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={p.id} />
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-ink-3">Nombre</span>
                <input name="name" defaultValue={p.name} required maxLength={120} autoFocus autoComplete="off" className={`${FIELD} h-10 text-[16px]`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-ink-3">Descripción</span>
                <textarea name="description" defaultValue={p.description ?? ""} maxLength={2000} rows={3} className={`${FIELD} py-2 text-[16px]`} />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(false)} className="press h-9 rounded-xl border border-line px-3 text-[13px] font-medium text-ink-2">Cancelar</button>
                <Submit className="press h-9 rounded-xl bg-accent px-3 text-[13px] font-semibold text-white">Guardar</Submit>
              </div>
            </form>
          ) : (
            <>
              {p.description ? <p className="mb-2 whitespace-pre-line text-[13px] text-ink-2">{p.description}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditing(true)} className="press h-9 rounded-xl border border-line px-3 text-[13px] font-medium text-ink-2">Editar</button>
                {p.status === "active"
                  ? <StatusButton id={p.id} status="paused" label="Pausar" />
                  : <StatusButton id={p.id} status="active" label="Reanudar" />}
                <StatusButton id={p.id} status="done" label="Terminar" />
                <StatusButton id={p.id} status="archived" label="Archivar" />
              </div>
              <p className="mt-2 text-[12px] text-ink-3">Terminar o archivar lo quita de la lista. Su carpeta de Craft se conserva.</p>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

function NewProject() {
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="press mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-line text-[14px] font-medium text-ink-2">
        <Plus size={16} strokeWidth={2.4} aria-hidden /> Nuevo proyecto
      </button>
    );
  }
  return (
    <form ref={form} action={async (fd) => { await createProject(fd); form.current?.reset(); setOpen(false); }}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-ink-3">Nuevo proyecto</span>
        <input name="name" required maxLength={120} autoFocus autoComplete="off" placeholder="Nombre" className={`${FIELD} h-11 text-[16px]`} />
      </label>
      <textarea name="description" maxLength={2000} rows={3} placeholder="De qué trata (opcional)" className={`${FIELD} py-2 text-[16px]`} />
      <p className="text-[12px] text-ink-3">Se crea también una carpeta en Craft, en «PROYECTOS HUB», con su ficha y sus tareas.</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="press h-10 rounded-xl border border-line px-4 text-[14px] font-medium text-ink-2">Cancelar</button>
        <Submit className="press h-10 rounded-xl bg-accent px-4 text-[14px] font-semibold text-white">Crear</Submit>
      </div>
    </form>
  );
}

export function ProjectList({ projects }: { projects: ProjectItem[] }) {
  return (
    <>
      {projects.length === 0 ? (
        <p className="text-[14px] text-ink-3">Sin proyectos. Crea uno para agrupar tareas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => <ProjectRow key={p.id} p={p} />)}
        </ul>
      )}
      <NewProject />
    </>
  );
}

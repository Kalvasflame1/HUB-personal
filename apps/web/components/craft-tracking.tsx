"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, ChevronRight, ExternalLink, Pencil } from "lucide-react";
import { Pill } from "@/components/ui";
import { dayShort } from "@/lib/format";
import { STATUS_KEY, TRACKING_STATUSES, statusLabel } from "@/lib/tracking";
import { setTrackingStatus, updateTracking } from "@/app/(hub)/productividad/actions";

export type TrackingItem = {
  external_id: string;
  title: string;
  category: string | null;
  status: string | null;
  due_date: string | null;
  period: string | null;
  notes: string | null;
  source_url: string | null;
  /** Hay un cambio pedido desde la app que el worker aún no ha guardado en Craft. */
  pending?: boolean;
  /** El último cambio no se pudo guardar (conflicto con Craft o error). */
  problem?: string | null;
};

const TONE: Record<string, "bad" | "warn" | "accent" | "good" | "neutral"> = {
  open: "bad",
  in_progress: "warn",
  watching: "accent",
  done: "good",
  expired: "neutral",
};
const FIELD = "h-10 w-full min-w-0 rounded-xl border border-line bg-bg px-2 text-[15px] outline-none focus:border-accent";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`press h-10 rounded-xl bg-accent px-4 text-[14px] font-semibold text-white ${pending ? "opacity-60" : ""}`}>
      {pending ? "Guardando…" : "Guardar"}
    </button>
  );
}

function DoneButton({ title }: { title: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-label={`Marcar como hecho: ${title}`}
      className={`press grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-good ${pending ? "opacity-40" : ""}`}>
      <Check size={17} strokeWidth={2.4} aria-hidden />
    </button>
  );
}

function EditForm({ item, categories, onDone }: { item: TrackingItem; categories: string[]; onDone: () => void }) {
  return (
    <li className="py-3">
      <form
        action={async (fd) => { await updateTracking(fd); onDone(); }}
        onKeyDown={(e) => { if (e.key === "Escape") onDone(); }}
        className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface-2/40 p-3"
      >
        <input type="hidden" name="external_id" value={item.external_id} />
        <label className="col-span-2 flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-medium text-ink-3">Asunto</span>
          <input name="title" defaultValue={item.title} required maxLength={300} autoFocus autoComplete="off" className={`${FIELD} px-3 text-[16px]`} />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-medium text-ink-3">Estado</span>
          <select name="status" defaultValue={item.status ?? TRACKING_STATUSES[0]} className={FIELD}>
            {TRACKING_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-medium text-ink-3">Fecha</span>
          <input name="due_date" type="date" defaultValue={item.due_date ?? ""} className={FIELD} />
        </label>
        <label className="col-span-2 flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-medium text-ink-3">Categoría</span>
          <select name="category" defaultValue={item.category ?? ""} className={FIELD}>
            <option value="">Sin cambiar</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="col-span-2 flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-medium text-ink-3">Notas del seguimiento</span>
          <textarea name="notes" defaultValue={item.notes ?? ""} rows={6} maxLength={10_000}
            className="w-full min-w-0 rounded-xl border border-line bg-bg px-3 py-2 text-[15px] leading-relaxed outline-none focus:border-accent" />
        </label>
        <p className="col-span-2 text-[12px] text-ink-3">Se guarda en Craft en menos de un minuto. Si Cowork ha cambiado el asunto mientras tanto, no se sobrescribe y te aviso. Craft no permite vaciar la fecha, la categoría ni las notas: si los dejas vacíos, se quedan como estaban.</p>
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onDone} className="press h-10 rounded-xl border border-line px-4 text-[14px] font-medium text-ink-2">Cancelar</button>
          <SaveButton />
        </div>
      </form>
    </li>
  );
}

function Row({ item, today, categories }: { item: TrackingItem; today: string; categories: string[] }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <EditForm item={item} categories={categories} onDone={() => setEditing(false)} />;
  const key = STATUS_KEY[item.status ?? ""] ?? "";
  const overdue = item.due_date && item.due_date < today && key !== "done";
  return (
    <li className="flex items-start gap-1">
      <details className="group min-w-0 flex-1">
        <summary className="press flex cursor-pointer list-none items-center gap-2 py-2.5 [&::-webkit-details-marker]:hidden">
          <ChevronRight size={16} className="shrink-0 text-ink-3 transition-transform group-open:rotate-90" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className={`text-[15px] leading-snug ${key === "done" ? "text-ink-3 line-through" : ""}`}>{item.title}</p>
            <p className="truncate text-[12px] text-ink-3">{[item.category, item.period].filter(Boolean).join(" · ")}</p>
            {item.pending ? <p className="text-[12px] text-ink-3">Pendiente de guardar en Craft…</p> : null}
            {item.problem ? <p className="text-[12px] text-bad">{item.problem}</p> : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Pill tone={TONE[key] ?? "neutral"}>{statusLabel(item.status)}</Pill>
            {item.due_date ? <span className={`tnum text-[12px] ${overdue ? "text-bad" : "text-ink-3"}`}>{dayShort(item.due_date)}</span> : null}
          </div>
        </summary>
        <div className="mb-3 ml-6 rounded-xl bg-surface-2 px-3 py-2.5">
          {item.notes ? <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{item.notes}</p> : <p className="text-[13px] text-ink-3">Sin notas.</p>}
          {item.source_url ? (
            <a href={item.source_url} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-accent">
              Abrir en Craft <ExternalLink size={13} aria-hidden />
            </a>
          ) : null}
        </div>
      </details>
      <div className="flex shrink-0 items-center pt-2">
        <button type="button" onClick={() => setEditing(true)} aria-label={`Editar ${item.title}`}
          className="press grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
          <Pencil size={16} aria-hidden />
        </button>
        {key !== "done" ? (
          <form action={setTrackingStatus}>
            <input type="hidden" name="external_id" value={item.external_id} />
            <input type="hidden" name="status" value="🟢 Hecho" />
            <DoneButton title={item.title} />
          </form>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Asuntos de la tabla «Seguimiento» de Craft. Se pueden editar y marcar como hechos: el cambio
 * queda en cola y el worker lo guarda en Craft. Cada fila se despliega para ver las notas.
 */
export function TrackingList({ items, today, categories }: { items: TrackingItem[]; today: string; categories: string[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((t) => <Row key={t.external_id} item={t} today={today} categories={categories} />)}
    </ul>
  );
}

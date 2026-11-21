import { dayShort } from "@/lib/format";

export type EventItem = { text: string; important?: boolean };
export type CraftEvent = { id: string; event_date: string | null; end_date: string | null; label: string; items: unknown };

const WEEKDAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function whenLabel(e: CraftEvent, today: string) {
  if (!e.event_date) return { top: "", bottom: e.label };
  const day = Number(e.event_date.slice(8, 10));
  const wd = WEEKDAY[new Date(`${e.event_date}T12:00:00Z`).getUTCDay()];
  const rel = e.event_date === today ? "hoy" : e.event_date === addDays(today, 1) ? "mañana" : wd;
  const end = e.end_date && e.end_date !== e.event_date ? `–${Number(e.end_date.slice(8, 10))}` : "";
  // «16 y 18»: dos días sueltos
  const pair = /^\d{1,2} y \d{1,2}$/.test(e.label) ? e.label.replace(" y ", "·") : null;
  return { top: pair ?? `${day}${end}`, bottom: rel };
}

/** Eventos sacados del «Informe Diario» de Craft (solo lectura). */
export function EventList({ events, today, showMonth = false }: { events: CraftEvent[]; today: string; showMonth?: boolean }) {
  const months = events.map((e) => (e.event_date ? dayShort(e.event_date).split(" ").slice(1).join(" ") : ""));
  return (
    <ul className="flex flex-col">
      {events.map((e, idx) => {
        const items = (Array.isArray(e.items) ? e.items : []) as EventItem[];
        const when = whenLabel(e, today);
        const prev = months.slice(0, idx).filter(Boolean).at(-1);
        const monthHeader = showMonth && months[idx] && prev && months[idx] !== prev ? months[idx] : null;
        const isToday = e.event_date === today || (e.event_date && e.end_date && e.event_date <= today && today <= e.end_date);
        return (
          <li key={e.id}>
            {monthHeader ? <p className="mb-1 mt-3 text-[12px] font-semibold uppercase tracking-wide text-ink-3">{monthHeader}</p> : null}
            <div className="flex gap-3 border-b border-line py-2.5 last:border-0">
              <div className="w-11 shrink-0 text-center">
                <p className={`tnum text-[18px] font-semibold leading-tight ${isToday ? "text-accent" : ""}`}>{when.top}</p>
                <p className={`text-[11px] ${isToday ? "font-medium text-accent" : "text-ink-3"}`}>{when.bottom}</p>
              </div>
              <p className="min-w-0 flex-1 text-[14px] leading-snug text-ink-2">
                {items.length === 0
                  ? e.label
                  : items.map((it, i) => (
                      <span key={i}>
                        {i > 0 ? <span className="text-ink-3"> · </span> : null}
                        <span className={it.important ? "font-semibold text-ink" : undefined}>{it.text}</span>
                      </span>
                    ))}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

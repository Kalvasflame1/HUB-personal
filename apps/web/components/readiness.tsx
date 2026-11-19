import { freshnessText, readiness } from "@/lib/fitness";

/** Barra de preparación del día, calculada a partir de la frescura (TSB). */
export function ReadinessBar({ tsb, className = "" }: { tsb: number; className?: string }) {
  const pct = readiness(tsb);
  // Semáforo: verde desde el 60 %, amarillo entre 35 y 60 %, rojo por debajo del 35 %
  const tone = pct >= 60 ? "bg-good" : pct >= 35 ? "bg-yellow-400" : "bg-bad";
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-2">Preparación de hoy</p>
        <p className="tnum text-[22px] font-semibold leading-none tracking-tight">
          {pct}<span className="ml-0.5 text-[14px] font-medium text-ink-3">%</span>
        </p>
      </div>
      <div
        className="mt-2 h-4 w-full overflow-hidden rounded-full bg-surface-2"
        role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Preparación de hoy"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <p className="mt-1.5 text-[12px] text-ink-3">{freshnessText(tsb)}</p>
    </div>
  );
}

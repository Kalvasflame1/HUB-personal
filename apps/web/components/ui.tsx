import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-line bg-surface p-5 md:p-6 ${className}`}>{children}</section>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-[34px]">{title}</h1>
        {subtitle ? <p className="mt-1 text-[15px] text-ink-2">{subtitle}</p> : null}
      </div>
      {children}
    </header>
  );
}

export function DemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">
      Demo
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2",
    accent: "bg-accent-soft text-accent",
    good: "bg-surface-2 text-good",
    warn: "bg-surface-2 text-warn",
    bad: "bg-surface-2 text-bad",
  } as const;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${tones[tone]}`}>{children}</span>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {hint ? <p className="mt-1 text-[13px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: ReactNode }) {
  return (
    <div>
      <p className="text-[13px] text-ink-3">{label}</p>
      <p className="tnum mt-1 text-[28px] font-semibold leading-none tracking-tight">
        {value}
        {unit ? <span className="ml-1 text-[14px] font-medium text-ink-3">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1.5 text-[12px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function SkeletonGrid({ blocks = 4 }: { blocks?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-6" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: blocks }).map((_, i) => (
        <div key={i} className={`skeleton h-44 ${i % 3 === 0 ? "md:col-span-4" : "md:col-span-2"}`} />
      ))}
    </div>
  );
}

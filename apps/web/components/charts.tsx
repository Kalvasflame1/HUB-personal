"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type WeekPoint = { label: string; km: number; pace: number | null; runs: number; load: number; hr: number | null };
export type MonthPoint = { label: string; km: number; runs: number };

const AXIS = { fontSize: 11, fill: "var(--ink-3)" } as const;

function paceLabel(s: number) {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
}

function Tip<T>({ active, payload, label, render, prefix = "Semana del " }: { active?: boolean; payload?: { payload: T }[]; label?: string; render: (p: T) => string; prefix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12px]">
      <p className="text-ink-3">{prefix}{label}</p>
      <p className="tnum mt-0.5 text-[14px] font-semibold text-ink">{render(payload[0].payload)}</p>
    </div>
  );
}

export function WeeklyKmChart({ data }: { data: WeekPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={38} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<Tip<WeekPoint> render={(p) => `${p.km.toLocaleString("es-ES", { maximumFractionDigits: 1 })} km · ${p.runs} ${p.runs === 1 ? "salida" : "salidas"}`} />} />
          <Bar dataKey="km" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaceChart({ data }: { data: WeekPoint[] }) {
  const points = data.filter((d) => d.pace);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
          {/* Eje invertido: más arriba = más rápido */}
          <YAxis reversed tick={AXIS} tickLine={false} axisLine={false} width={38} domain={["dataMin - 5", "dataMax + 5"]} tickFormatter={paceLabel} allowDecimals={false} />
          <Tooltip cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }} content={<Tip<WeekPoint> render={(p) => `${paceLabel(p.pace ?? 0)} min/km`} />} />
          <Line type="monotone" dataKey="pace" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LoadChart({ data }: { data: WeekPoint[] }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={38} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<Tip<WeekPoint> render={(p) => `Carga ${p.load}`} />} />
          <Bar dataKey="load" fill="var(--ink-3)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyKmChart({ data }: { data: MonthPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={38} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<Tip<MonthPoint> prefix="" render={(p) => `${p.km.toLocaleString("es-ES", { maximumFractionDigits: 1 })} km · ${p.runs} ${p.runs === 1 ? "salida" : "salidas"}`} />} />
          <Bar dataKey="km" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HeartRateChart({ data }: { data: WeekPoint[] }) {
  const points = data.filter((d) => d.hr);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={38} domain={["dataMin - 3", "dataMax + 3"]} allowDecimals={false} />
          <Tooltip cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }} content={<Tip<WeekPoint> render={(p) => `${Math.round(p.hr ?? 0)} ppm`} />} />
          <Line type="monotone" dataKey="hr" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

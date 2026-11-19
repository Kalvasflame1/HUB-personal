"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FitnessPoint } from "@/lib/fitness";

export type WeekPoint = { label: string; km: number; pace: number | null; runs: number; load: number; hr: number | null };
export type MonthPoint = { label: string; km: number; runs: number };

const AXIS = { fontSize: 11, fill: "var(--ink-3)" } as const;

function paceLabel(s: number) {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
}

function Tip<T>({ active, payload, label, render, prefix = "Semana del ", formatLabel }: { active?: boolean; payload?: { payload: T }[]; label?: string; render: (p: T) => string; prefix?: string; formatLabel?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12px]">
      <p className="text-ink-3">{prefix}{formatLabel && label ? formatLabel(String(label)) : label}</p>
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

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].toLowerCase()} ${y}`;
}

type FitnessKey = "ctl" | "atl" | "tsb";
const FITNESS_PANELS: { key: FitnessKey; title: string; hint: string; color: string; fill: string }[] = [
  { key: "ctl", title: "Forma (CTL)", hint: "carga media de 42 días", color: "var(--accent)", fill: "var(--accent-soft)" },
  { key: "atl", title: "Fatiga (ATL)", hint: "carga media de 7 días", color: "var(--ink-2)", fill: "transparent" },
  { key: "tsb", title: "Frescura (TSB)", hint: "forma − fatiga", color: "var(--accent)", fill: "var(--accent-soft)" },
];

/**
 * Forma, fatiga y frescura en tres paneles apilados con el mismo eje de fechas.
 * Comparten `syncId`, así que al señalar un día se ve el valor en los tres a la vez.
 */
export function FitnessCharts({ data }: { data: FitnessPoint[] }) {
  // Marcas del eje: el día 1 de cada mes, alternos para que quepan en el iPhone
  const ticks = data.filter((d) => d.date.endsWith("-01")).map((d) => d.date).filter((_, i, all) => all.length <= 7 || i % 2 === all.length % 2);
  return (
    <div className="space-y-3">
      {FITNESS_PANELS.map((p, i) => {
        const last = i === FITNESS_PANELS.length - 1;
        const current = data.at(-1)?.[p.key] ?? 0;
        return (
          <div key={p.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium">
                {p.title} <span className="font-normal text-ink-3">· {p.hint}</span>
              </p>
              <p className="tnum text-[15px] font-semibold">{current.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</p>
            </div>
            <div className={last ? "h-36 w-full" : "h-28 w-full"}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} syncId="fitness" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="date" ticks={ticks} tickFormatter={(v: string) => MONTHS[Number(v.slice(5, 7)) - 1]} tick={last ? AXIS : false} height={last ? 24 : 1} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={38} allowDecimals={false} domain={p.key === "tsb" ? ["auto", "auto"] : [0, "auto"]} />
                  {p.key === "tsb" ? <ReferenceLine y={0} stroke="var(--ink-3)" /> : null}
                  <Tooltip
                    cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }}
                    content={<Tip<FitnessPoint> prefix="" formatLabel={dayLabel} render={(d) => `${p.title.split(" ")[0]} ${d[p.key].toLocaleString("es-ES", { maximumFractionDigits: 1 })}`} />}
                  />
                  <Area type="monotone" dataKey={p.key} stroke={p.color} strokeWidth={2} fill={p.fill} fillOpacity={1} baseValue={0} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

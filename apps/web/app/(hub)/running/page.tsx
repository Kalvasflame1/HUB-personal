import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, DemoBadge, Empty, PageHeader, SkeletonGrid, Stat } from "@/components/ui";
import { HeartRateChart, LoadChart, MonthlyKmChart, PaceChart, WeeklyKmChart, type MonthPoint, type WeekPoint } from "@/components/charts";
import { capitalize, dateShort, dayShort, duration, km, monthName, monthStartISO, num, pace, relative, todayISO, weekStartISO } from "@/lib/format";

export const metadata: Metadata = { title: "Running" };

export default function RunningPage() {
  return (
    <>
      <PageHeader title="Running" subtitle="Volumen, ritmo, carga y marcas." />
      <Suspense fallback={<SkeletonGrid blocks={5} />}>
        <Content />
      </Suspense>
    </>
  );
}

const PR_LABEL: Record<string, string> = { "1k": "1 km", "5k": "5 km", "10k": "10 km", half_marathon: "Media maratón", marathon: "Maratón" };
const PR_ORDER = ["1k", "5k", "10k", "half_marathon", "marathon"];
const RUN_TYPES = ["Run", "TrailRun", "VirtualRun"];

async function Content() {
  const { supabase } = await getSession();
  const [weeklyRes, monthlyRes, prsRes, recentRes, mtdRes, syncRes] = await Promise.all([
    supabase.from("v_running_weekly").select("week_start,km,runs,pace_s_per_km,avg_hr,load").order("week_start", { ascending: false }).limit(12),
    supabase.from("v_running_monthly").select("month_start,km,runs,pace_s_per_km,avg_hr").order("month_start", { ascending: false }).limit(12),
    supabase.from("personal_records").select("distance_key,time_s,achieved_at,activity_id,is_demo").eq("is_current", true),
    supabase.from("strava_activities").select("id,name,start_date,distance_m,moving_time_s,average_heartrate,elevation_gain_m,is_demo").in("sport_type", RUN_TYPES).order("start_date", { ascending: false }).limit(10),
    supabase.from("strava_activities").select("start_date_local,distance_m").in("sport_type", RUN_TYPES).gte("start_date_local", monthStartISO(-1)),
    supabase.from("job_runs").select("finished_at,status,error,details").eq("job_name", "strava_sync").order("started_at", { ascending: false }).limit(1),
  ]);

  const recent = recentRes.data ?? [];
  const lastSync = syncRes.data?.[0];
  if (recent.length === 0) {
    return (
      <Empty
        title="Todavía no hay entrenamientos"
        hint="Conecta Strava desde el Mac con npm run strava:auth --workspace apps/worker y sincroniza con npm run strava:sync --workspace apps/worker."
      />
    );
  }

  const byWeek = new Map((weeklyRes.data ?? []).map((w) => [String(w.week_start).slice(0, 10), w]));
  const weeks: WeekPoint[] = Array.from({ length: 12 }, (_, i) => weekStartISO(-(11 - i))).map((start) => {
    const w = byWeek.get(start);
    return { label: dayShort(start), km: Number(w?.km ?? 0), pace: w?.pace_s_per_km ? Number(w.pace_s_per_km) : null, runs: w?.runs ?? 0, load: Number(w?.load ?? 0), hr: w?.avg_hr ? Number(w.avg_hr) : null };
  });
  const thisWeek = weeks[11];
  const lastWeek = weeks[10];

  const byMonth = new Map((monthlyRes.data ?? []).map((m) => [String(m.month_start).slice(0, 10), m]));
  const month = byMonth.get(monthStartISO());
  const prevMonth = byMonth.get(monthStartISO(-1));
  const monthKm = Number(month?.km ?? 0);
  const prevMonthKm = Number(prevMonth?.km ?? 0);

  // Comparativa justa: el mes en curso frente al mismo número de días del mes anterior
  const today = Number(todayISO().slice(8, 10));
  const prevMonthPrefix = monthStartISO(-1).slice(0, 7);
  const prevToDateKm = (mtdRes.data ?? [])
    .filter((a) => a.start_date_local.startsWith(prevMonthPrefix) && Number(a.start_date_local.slice(8, 10)) <= today)
    .reduce((s, a) => s + Number(a.distance_m) / 1000, 0);
  const mtdDelta = monthKm - prevToDateKm;

  const monthByStart = new Map((monthlyRes.data ?? []).map((m) => [String(m.month_start).slice(0, 10), m]));
  const months: MonthPoint[] = Array.from({ length: 12 }, (_, i) => monthStartISO(-(11 - i))).map((start) => {
    const m = monthByStart.get(start);
    return { label: capitalize(monthName(start).slice(0, 3)), km: Number(m?.km ?? 0), runs: m?.runs ?? 0 };
  });

  // Carga aguda (7 días) frente a crónica (media semanal de 28 días), sobre semanas completas
  const acute = lastWeek.load;
  const chronic = weeks.slice(7, 11).reduce((s, w) => s + w.load, 0) / 4;
  const ratio = chronic ? acute / chronic : 0;
  const ratioText = !chronic ? "Sin datos suficientes" : ratio > 1.3 ? "Carga alta: prioriza recuperar" : ratio < 0.8 ? "Carga baja: margen para subir" : "Carga equilibrada";

  const prs = (prsRes.data ?? []).sort((a, b) => PR_ORDER.indexOf(a.distance_key) - PR_ORDER.indexOf(b.distance_key));
  const anyDemo = recent.some((r) => r.is_demo);

  const hasHr = weeks.some((w) => w.hr);
  const syncDetails = (lastSync?.details ?? {}) as { pending_details?: number; demo?: boolean };
  const pendingDetails = Number(syncDetails.pending_details ?? 0);

  return (
    <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
      <p className="-mt-2 text-[13px] text-ink-3 lg:col-span-6">
        {lastSync?.finished_at
          ? `Última sincronización con Strava ${relative(lastSync.finished_at)}${lastSync.status === "error" ? " (con error)" : ""}${syncDetails.demo ? " (demo)" : ""}${pendingDetails ? ` · ${pendingDetails} entrenamientos aún sin detalle` : ""}`
          : "Sin sincronizar con Strava todavía"}
      </p>
      <Card className="lg:col-span-6">
        <CardTitle action={<DemoBadge show={anyDemo} />}>Resumen</CardTitle>
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
          <Stat label="Esta semana" value={num(thisWeek.km, 1)} unit="km" hint={`${thisWeek.runs} ${thisWeek.runs === 1 ? "salida" : "salidas"}`} />
          <Stat label="Semana anterior" value={num(lastWeek.km, 1)} unit="km" hint={lastWeek.pace ? `${pace(lastWeek.pace)} min/km` : undefined} />
          <Stat
            label={capitalize(monthName(monthStartISO()))}
            value={num(monthKm, 1)}
            unit="km"
            hint={`${month?.runs ?? 0} salidas · ${mtdDelta >= 0 ? "+" : "−"}${num(Math.abs(mtdDelta), 1)} km frente al ${today} de ${monthName(monthStartISO(-1))}`}
          />
          <Stat label={capitalize(monthName(monthStartISO(-1)))} value={num(prevMonthKm, 1)} unit="km" hint={prevMonth?.pace_s_per_km ? `${pace(Number(prevMonth.pace_s_per_km))} min/km` : undefined} />
        </div>
      </Card>

      <Card className="lg:col-span-4">
        <CardTitle>Kilómetros por semana</CardTitle>
        <WeeklyKmChart data={weeks} />
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle>Carga y recuperación</CardTitle>
        <p className="tnum text-[40px] font-semibold leading-none tracking-tight">{chronic ? num(ratio, 2) : "–"}</p>
        <p className="mt-2 text-[14px] font-medium">{ratioText}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
          Carga de la última semana completa ({num(acute)}) entre la media de las cuatro anteriores ({num(chronic)}). Entre 0,8 y 1,3 se considera equilibrada.
        </p>
        <div className="mt-3"><LoadChart data={weeks} /></div>
      </Card>

      <Card className="lg:col-span-3">
        <CardTitle>Ritmo medio por semana (min/km)</CardTitle>
        <PaceChart data={weeks} />
        <p className="mt-2 text-[12px] text-ink-3">El eje está invertido: más arriba es más rápido.</p>
      </Card>

      <Card className="lg:col-span-3">
        <CardTitle>Pulso medio por semana (ppm)</CardTitle>
        {hasHr ? <HeartRateChart data={weeks} /> : <Empty title="Sin datos de pulso" hint="Aparecerán al registrar carreras con pulsómetro." />}
      </Card>

      <Card className="lg:col-span-4">
        <CardTitle>Kilómetros por mes</CardTitle>
        <MonthlyKmChart data={months} />
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle>Marcas personales</CardTitle>
        {prs.length === 0 ? (
          <Empty title="Sin marcas todavía" />
        ) : (
          <ul className="divide-y divide-line">
            {prs.map((r) => (
              <li key={r.distance_key}>
                <Link href={r.activity_id ? `/running/${r.activity_id}` : "/running"} className="press flex items-baseline justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-[15px] font-medium">{PR_LABEL[r.distance_key] ?? r.distance_key}</p>
                    <p className="text-[12px] text-ink-3">{dateShort(r.achieved_at)}</p>
                  </div>
                  <p className="tnum text-[20px] font-semibold tracking-tight">{duration(r.time_s)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="lg:col-span-6">
        <CardTitle>Últimos entrenamientos</CardTitle>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[14px]">
            <thead>
              <tr className="text-[12px] text-ink-3">
                <th className="px-2 pb-2 font-medium">Fecha</th>
                <th className="px-2 pb-2 font-medium">Sesión</th>
                <th className="px-2 pb-2 text-right font-medium">Distancia</th>
                <th className="px-2 pb-2 text-right font-medium">Tiempo</th>
                <th className="px-2 pb-2 text-right font-medium">Ritmo</th>
                <th className="px-2 pb-2 text-right font-medium">Pulso</th>
              </tr>
            </thead>
            <tbody className="tnum divide-y divide-line">
              {recent.map((a) => (
                <tr key={a.id}>
                  <td className="px-2 py-2.5 text-ink-2">{dateShort(a.start_date)}</td>
                  <td className="px-2 py-2.5 font-medium">
                    {a.is_demo ? a.name : <Link href={`/running/${a.id}`} className="hover:text-accent">{a.name}</Link>}
                  </td>
                  <td className="px-2 py-2.5 text-right">{km(a.distance_m, 2)} km</td>
                  <td className="px-2 py-2.5 text-right">{duration(a.moving_time_s)}</td>
                  <td className="px-2 py-2.5 text-right">{pace(a.distance_m ? a.moving_time_s / (a.distance_m / 1000) : null)}</td>
                  <td className="px-2 py-2.5 text-right text-ink-2">{a.average_heartrate ? num(a.average_heartrate) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

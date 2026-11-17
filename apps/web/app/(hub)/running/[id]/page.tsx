import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, DemoBadge, Empty, Pill, SkeletonGrid, Stat } from "@/components/ui";
import { dateLong, duration, km, num, pace } from "@/lib/format";

export const metadata: Metadata = { title: "Entrenamiento" };

export default function ActivityPage({ params }: PageProps<"/running/[id]">) {
  return (
    <>
      <Link href="/running" className="press mb-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent">
        <ArrowLeft size={16} aria-hidden /> Running
      </Link>
      <Suspense fallback={<SkeletonGrid blocks={3} />}>
        {params.then(({ id }) => <Content id={id} />)}
      </Suspense>
    </>
  );
}

const EFFORT_LABEL: Record<string, string> = {
  "400m": "400 m", "1/2 mile": "½ milla", "1k": "1 km", "1K": "1 km", "5K": "5 km", "10K": "10 km", "15K": "15 km", "20K": "20 km", "30K": "30 km", "1 mile": "1 milla", "2 mile": "2 millas",
  "5k": "5 km", "10k": "10 km", "15k": "15 km", "10 mile": "10 millas", "20k": "20 km",
  "Half-Marathon": "Media maratón", "30k": "30 km", "Marathon": "Maratón",
};

async function Content({ id }: { id: string }) {
  if (!/^-?\d+$/.test(id)) notFound();
  const { supabase } = await getSession();
  const [actRes, lapsRes, effortsRes] = await Promise.all([
    supabase
      .from("strava_activities")
      .select("id,name,sport_type,start_date,distance_m,moving_time_s,elapsed_time_s,elevation_gain_m,average_heartrate,max_heartrate,average_cadence,suffer_score,calories,has_detail,is_demo")
      .eq("id", Number(id))
      .maybeSingle(),
    supabase.from("strava_laps").select("id,lap_index,distance_m,moving_time_s,average_heartrate").eq("activity_id", Number(id)).order("lap_index"),
    supabase.from("strava_best_efforts").select("id,name,distance_m,elapsed_time_s,pr_rank").eq("activity_id", Number(id)).order("distance_m"),
  ]);

  const a = actRes.data;
  if (!a) notFound();
  const laps = lapsRes.data ?? [];
  const efforts = effortsRes.data ?? [];
  const secPerKm = a.distance_m ? a.moving_time_s / (Number(a.distance_m) / 1000) : null;

  return (
    <div className="rise">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-[34px]">{a.name}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{dateLong(a.start_date)}</p>
        </div>
        {a.is_demo ? (
          <DemoBadge />
        ) : (
          <a href={`https://www.strava.com/activities/${a.id}`} target="_blank" rel="noreferrer" className="press inline-flex items-center gap-1 text-[14px] font-medium text-accent">
            Ver en Strava <ArrowUpRight size={15} aria-hidden />
          </a>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
        <Card className="lg:col-span-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
            <Stat label="Distancia" value={km(Number(a.distance_m), 2)} unit="km" />
            <Stat label="Tiempo en movimiento" value={duration(a.moving_time_s)} hint={a.elapsed_time_s > a.moving_time_s + 60 ? `${duration(a.elapsed_time_s)} en total` : undefined} />
            <Stat label="Ritmo medio" value={pace(secPerKm)} unit="min/km" />
            <Stat label="Desnivel" value={num(a.elevation_gain_m)} unit="m" />
            <Stat label="Pulso medio" value={a.average_heartrate ? num(a.average_heartrate) : "–"} unit={a.average_heartrate ? "ppm" : undefined} hint={a.max_heartrate ? `Máximo ${num(a.max_heartrate)}` : undefined} />
            {/* Strava da la cadencia de carrera por pierna: se duplica para pasos por minuto */}
            <Stat label="Cadencia" value={a.average_cadence ? num(Number(a.average_cadence) * 2) : "–"} unit={a.average_cadence ? "pasos/min" : undefined} />
            <Stat label="Esfuerzo relativo" value={a.suffer_score != null ? num(a.suffer_score) : "–"} />
            <Stat label="Calorías" value={a.calories ? num(a.calories) : "–"} unit={a.calories ? "kcal" : undefined} />
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardTitle>Parciales</CardTitle>
          {laps.length === 0 ? (
            <Empty title={a.has_detail ? "Sin parciales" : "Detalle pendiente"} hint={a.has_detail ? undefined : "Se descargará en una próxima sincronización."} />
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[14px]">
                <thead>
                  <tr className="text-[12px] text-ink-3">
                    <th className="px-2 pb-2 font-medium">Vuelta</th>
                    <th className="px-2 pb-2 text-right font-medium">Distancia</th>
                    <th className="px-2 pb-2 text-right font-medium">Tiempo</th>
                    <th className="px-2 pb-2 text-right font-medium">Ritmo</th>
                    <th className="px-2 pb-2 text-right font-medium">Pulso</th>
                  </tr>
                </thead>
                <tbody className="tnum divide-y divide-line">
                  {laps.map((l) => (
                    <tr key={l.id}>
                      <td className="px-2 py-2 text-ink-2">{l.lap_index}</td>
                      <td className="px-2 py-2 text-right">{km(Number(l.distance_m), 2)} km</td>
                      <td className="px-2 py-2 text-right">{duration(l.moving_time_s)}</td>
                      <td className="px-2 py-2 text-right font-medium">{pace(l.distance_m && l.moving_time_s ? l.moving_time_s / (Number(l.distance_m) / 1000) : null)}</td>
                      <td className="px-2 py-2 text-right text-ink-2">{l.average_heartrate ? num(l.average_heartrate) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Mejores esfuerzos</CardTitle>
          {efforts.length === 0 ? (
            <Empty title={a.has_detail ? "Sin esfuerzos registrados" : "Detalle pendiente"} />
          ) : (
            <ul className="divide-y divide-line">
              {efforts.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-[15px] font-medium">
                    {EFFORT_LABEL[e.name] ?? e.name}
                    {e.pr_rank === 1 ? <Pill tone="good">Marca</Pill> : e.pr_rank ? <Pill>{e.pr_rank}.º mejor</Pill> : null}
                  </span>
                  <span className="tnum text-[17px] font-semibold tracking-tight">{duration(e.elapsed_time_s)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

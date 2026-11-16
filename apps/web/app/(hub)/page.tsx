import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, DemoBadge, Empty, Pill, SkeletonGrid } from "@/components/ui";
import { CRAFT_DOCS } from "@/lib/knowledge";
import { capitalize, dateLong, dayShort, greeting, num, pace, relative, weekStartISO } from "@/lib/format";

export default function DashboardPage() {
  return (
    <Suspense fallback={<SkeletonGrid blocks={6} />}>
      <Dashboard />
    </Suspense>
  );
}

const LEVEL_ICON = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert } as const;
const LEVEL_TONE = { info: "text-ink-3", success: "text-good", warning: "text-warn", error: "text-bad" } as const;

async function Dashboard() {
  const { supabase, user } = await getSession();

  const [profile, tasks, weekly, activity, reports, notifications] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("v_tasks_pending").select("id,title,due_date,priority,overdue,project_name,is_demo").order("due_date", { ascending: true, nullsFirst: false }).order("priority"),
    supabase.from("v_running_weekly").select("week_start,km,runs,pace_s_per_km").order("week_start", { ascending: false }).limit(8),
    supabase.from("activity_log").select("id,title,kind,occurred_at,is_demo").order("occurred_at", { ascending: false }).limit(5),
    supabase.from("reports").select("id,kind,title,period_start,is_demo").order("period_start", { ascending: false }).limit(3),
    supabase.from("notifications").select("id,level,title,body,created_at").is("read_at", null).order("created_at", { ascending: false }).limit(4),
  ]);

  const pending = tasks.data ?? [];
  const overdue = pending.filter((t) => t.overdue).length;
  const thisWeek = weekStartISO();
  const weeks = Array.from({ length: 8 }, (_, i) => weekStartISO(-(7 - i))).map((start) => {
    const row = (weekly.data ?? []).find((w) => String(w.week_start).slice(0, 10) === start);
    return { start, km: Number(row?.km ?? 0), runs: row?.runs ?? 0, pace: Number(row?.pace_s_per_km ?? 0) };
  });
  const current = weeks[weeks.length - 1];
  const previous = weeks[weeks.length - 2];
  const maxKm = Math.max(1, ...weeks.map((w) => w.km));
  const name = profile.data?.display_name ? capitalize(profile.data.display_name) : "";
  const anyDemo = pending.some((t) => t.is_demo) || (activity.data ?? []).some((a) => a.is_demo);

  return (
    <div className="rise grid grid-cols-1 gap-4 md:grid-cols-6">
      <Card className="md:col-span-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] text-ink-2">{capitalize(dateLong(new Date()))}</p>
          <DemoBadge show={anyDemo} />
        </div>
        <h1 className="mt-2 text-[32px] font-bold leading-[1.05] tracking-tight md:text-[44px]">
          {greeting()}{name ? `, ${name}` : ""}.
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2">
          Tienes <strong className="font-semibold text-ink">{pending.length} {pending.length === 1 ? "tarea pendiente" : "tareas pendientes"}</strong>
          {overdue > 0 ? <> , <span className="font-semibold text-bad">{overdue} {overdue === 1 ? "vencida" : "vencidas"}</span></> : null}
          {" "}y llevas <strong className="tnum font-semibold text-ink">{num(current.km, 1)} km</strong> esta semana
          {previous.km > 0 ? <> ({num(previous.km, 1)} km la anterior)</> : null}.
        </p>
      </Card>

      <Card className="md:col-span-2">
        <CardTitle action={<Link href="/running" className="text-[13px] font-medium text-accent">Ver todo</Link>}>Running</CardTitle>
        <p className="tnum text-[40px] font-semibold leading-none tracking-tight">
          {num(current.km, 1)}<span className="ml-1 text-[15px] font-medium text-ink-3">km esta semana</span>
        </p>
        <p className="mt-2 text-[13px] text-ink-3">
          {current.runs} {current.runs === 1 ? "salida" : "salidas"}
          {previous.pace ? ` · semana anterior a ${pace(previous.pace)} min/km` : ""}
        </p>
        <div className="mt-5 flex h-20 items-end gap-[6px]" role="img" aria-label="Kilómetros de las últimas 8 semanas">
          {weeks.map((w) => (
            <div key={w.start} className="group relative flex h-full flex-1 items-end" title={`Semana del ${dayShort(w.start)}: ${num(w.km, 1)} km`}>
              <div
                className={`w-full rounded-t-[4px] ${w.start === thisWeek ? "bg-accent" : "bg-ink-3/35"}`}
                style={{ height: `${Math.max(3, (w.km / maxKm) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-3">
          <span>{dayShort(weeks[0].start)}</span>
          <span>Esta semana</span>
        </div>
      </Card>

      <Card className="md:col-span-3">
        <CardTitle action={<Link href="/productividad" className="text-[13px] font-medium text-accent">Ver todas</Link>}>Tareas pendientes</CardTitle>
        {pending.length === 0 ? (
          <Empty title="Nada pendiente" hint="Añade tareas desde Productividad." />
        ) : (
          <ul className="divide-y divide-line">
            {pending.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px]">{t.title}</p>
                  {t.project_name ? <p className="truncate text-[12px] text-ink-3">{t.project_name}</p> : null}
                </div>
                {t.due_date ? <Pill tone={t.overdue ? "bad" : "neutral"}>{dayShort(t.due_date)}</Pill> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="md:col-span-3">
        <CardTitle>Actividad reciente</CardTitle>
        {(activity.data ?? []).length === 0 ? (
          <Empty title="Sin actividad todavía" />
        ) : (
          <ul className="flex flex-col gap-3">
            {(activity.data ?? []).map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-[15px]">{a.title}</p>
                <p className="shrink-0 text-[12px] text-ink-3">{relative(a.occurred_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="md:col-span-2">
        <CardTitle action={<Link href="/informes" className="text-[13px] font-medium text-accent">Ver todos</Link>}>Informes</CardTitle>
        {(reports.data ?? []).length === 0 ? (
          <Empty title="Aún no hay informes" />
        ) : (
          <ul className="flex flex-col gap-3">
            {(reports.data ?? []).map((r) => (
              <li key={r.id}>
                <Link href="/informes" className="press block">
                  <p className="text-[15px] font-medium">{r.title}</p>
                  <p className="text-[12px] text-ink-3">{dayShort(r.period_start)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="md:col-span-2">
        <CardTitle>Avisos</CardTitle>
        {(notifications.data ?? []).length === 0 ? (
          <Empty title="Sin avisos" />
        ) : (
          <ul className="flex flex-col gap-3">
            {(notifications.data ?? []).map((n) => {
              const level = (n.level in LEVEL_ICON ? n.level : "info") as keyof typeof LEVEL_ICON;
              const Icon = LEVEL_ICON[level];
              return (
                <li key={n.id} className="flex gap-2.5">
                  <Icon size={17} className={`mt-0.5 shrink-0 ${LEVEL_TONE[level]}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium leading-snug">{n.title}</p>
                    {n.body ? <p className="text-[12px] text-ink-3">{n.body}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="md:col-span-2">
        <CardTitle action={<Link href="/conocimiento" className="text-[13px] font-medium text-accent">Ver todo</Link>}>Craft</CardTitle>
        <ul className="flex flex-col gap-2.5">
          {CRAFT_DOCS.slice(0, 4).map((d) => (
            <li key={d.href}>
              <a href={d.href} className="press flex items-center justify-between gap-2 text-[15px]">
                <span className="truncate">{d.title}</span>
                <ArrowUpRight size={15} className="shrink-0 text-ink-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

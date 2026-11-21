import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight, CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, DemoBadge, Empty, Pill, SkeletonGrid } from "@/components/ui";
import { CRAFT_DOCS } from "@/lib/knowledge";
import { markNotificationRead } from "./actions";
import { PodcastPlayer } from "@/components/podcast-player";
import { ElevenReaderButton } from "@/components/elevenreader-button";
import { ReadinessBar } from "@/components/readiness";
import { EventList } from "@/components/craft-events";
import { loadFitness } from "@/lib/fitness-data";
import { capitalize, dateLong, dayShort, greeting, num, pace, relative, todayISO, weekStartISO } from "@/lib/format";

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

  const [profile, tasks, weekly, activity, reports, notifications, episodes, fitness, eventsRes] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("v_tasks_pending").select("id,title,due_date,priority,overdue,project_name,is_demo").order("due_date", { ascending: true, nullsFirst: false }).order("priority"),
    supabase.from("v_running_weekly").select("week_start,km,runs,pace_s_per_km").order("week_start", { ascending: false }).limit(8),
    supabase.from("activity_log").select("id,title,kind,occurred_at,is_demo").order("occurred_at", { ascending: false }).limit(5),
    supabase.from("reports").select("id,kind,title,period_start,is_demo").order("period_start", { ascending: false }).limit(3),
    supabase.from("notifications").select("id,level,title,body,link,created_at", { count: "exact" }).is("read_at", null).order("created_at", { ascending: false }).limit(4),
    supabase.from("podcast_episodes").select("id,episode_date,title,storage_path,duration_s").order("episode_date", { ascending: false }).limit(1),
    loadFitness(supabase), // misma ventana que Running para que los valores coincidan
    supabase.from("craft_events").select("id,event_date,end_date,label,items").or(`event_date.gte.${todayISO()},end_date.gte.${todayISO()}`).lte("event_date", addDaysISO(todayISO(), 7)).order("position"),
  ]);

  // Último episodio del podcast: URL firmada de 3 horas (el bucket es privado)
  const episode = episodes.data?.[0];
  const episodeUrl = episode ? (await supabase.storage.from("podcast").createSignedUrl(episode.storage_path, 3 * 3600)).data?.signedUrl : null;

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
  const nowFitness = fitness.at(-1);
  const events = eventsRes.data ?? [];
  const anyDemo = pending.some((t) => t.is_demo) || (activity.data ?? []).some((a) => a.is_demo);

  return (
    <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
      <Card className="lg:col-span-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[19px] font-medium text-ink-2 md:text-[22px]">{capitalize(dateLong(new Date()))}</p>
          <DemoBadge show={anyDemo} />
        </div>
        <h1 className="mt-2 text-[32px] font-bold leading-[1.05] tracking-tight md:text-[44px]">
          {greeting()}{name ? `, ${name}` : ""}.
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2">
          Tienes <strong className="font-semibold text-ink">{pending.length} {pending.length === 1 ? "tarea pendiente" : "tareas pendientes"}</strong>{overdue > 0 ? <>, <span className="font-semibold text-bad">{overdue} {overdue === 1 ? "vencida" : "vencidas"}</span>,</> : null}
          {" "}y llevas <strong className="tnum font-semibold text-ink">{num(current.km, 1)} km</strong> esta semana
          {previous.km > 0 ? <> ({num(previous.km, 1)} km la anterior)</> : null}.
        </p>
        {nowFitness ? (
          <Link href="/running" className="press mt-5 block">
            <ReadinessBar tsb={nowFitness.tsb} />
          </Link>
        ) : null}
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle action={<Link href="/running" className="text-[13px] font-medium text-accent">Ver todo</Link>}>Running</CardTitle>
        <p className="tnum text-[40px] font-semibold leading-none tracking-tight">
          {num(current.km, 1)}<span className="ml-1 text-[15px] font-medium text-ink-3">km</span>
        </p>
        <p className="mt-2 text-[13px] text-ink-3">
          Esta semana · {current.runs} {current.runs === 1 ? "salida" : "salidas"}
        </p>
        {previous.pace ? <p className="text-[13px] text-ink-3">Anterior: {num(previous.km, 1)} km a {pace(previous.pace)} min/km</p> : null}
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

      <Card className="lg:col-span-2">
        <CardTitle>Podcast de hoy</CardTitle>
        {episode && episodeUrl ? (
          <PodcastPlayer
            id={episode.id} src={episodeUrl} title={episode.title} duration={episode.duration_s}
            subtitle={`${capitalize(dateLong(new Date(`${episode.episode_date}T12:00:00`)))}${episode.duration_s ? ` · ${Math.round(episode.duration_s / 60)} min` : ""}`}
          />
        ) : (
          <Empty title="Aún no hay episodios" hint="El Mac mini subirá aquí el audio del Resumen diario cada mañana." />
        )}
        <ElevenReaderButton />
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle action={<Link href="/productividad" className="text-[13px] font-medium text-accent">Ver todos</Link>}>Próximos eventos</CardTitle>
        {events.length === 0 ? (
          <Empty title="Nada en los próximos 7 días" hint="Se leen del Informe Diario de Craft." />
        ) : (
          <EventList events={events} today={todayISO()} />
        )}
      </Card>

      <Card className="lg:col-span-2">
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

      <Card className="lg:col-span-2">
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

      <Card className="lg:col-span-2">
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

      <Card className="lg:col-span-2">
        <CardTitle
          action={(notifications.count ?? 0) > 1 ? (
            <form action={markNotificationRead}>
              <input type="hidden" name="id" value="all" />
              <button type="submit" className="press text-[13px] font-medium text-accent">Marcar todos ({notifications.count})</button>
            </form>
          ) : null}
        >
          Avisos
        </CardTitle>
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
                  <div className="min-w-0 flex-1">
                    {n.link ? (
                      <Link href={n.link} className="press text-[14px] font-medium leading-snug">{n.title}</Link>
                    ) : (
                      <p className="text-[14px] font-medium leading-snug">{n.title}</p>
                    )}
                    {n.body ? <p className="text-[12px] text-ink-3">{n.body}</p> : null}
                    <p className="text-[12px] text-ink-3">{relative(n.created_at)}</p>
                  </div>
                  <form action={markNotificationRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" aria-label="Marcar como leído" className="press -mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
                      <X size={16} aria-hidden />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="lg:col-span-2">
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

function addDaysISO(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

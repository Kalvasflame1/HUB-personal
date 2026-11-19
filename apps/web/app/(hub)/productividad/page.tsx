import { Suspense } from "react";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, DemoBadge, Empty, PageHeader, Pill, SkeletonGrid } from "@/components/ui";
import { dayShort, isoDaysAgo, relative, todayISO } from "@/lib/format";
import { addTask } from "./actions";
import { craftUrl } from "@/lib/knowledge";
import { DocLinks, TaskRow, type DocLink } from "./task-row";

export const metadata: Metadata = { title: "Productividad" };

export default function ProductividadPage() {
  return (
    <>
      <PageHeader title="Productividad" subtitle="Tareas, proyectos y automatizaciones." />
      <Suspense fallback={<SkeletonGrid />}>
        <Content />
      </Suspense>
    </>
  );
}

const PRIORITY = ["", "Máxima", "Alta", "Media", "Baja"];
const JOB_LABEL: Record<string, string> = {
  strava_sync: "Sincronización de Strava",
  craft_index: "Índice de Craft",
  web_fetch: "Fuentes web",
  watchdog: "Vigilancia de tareas",
  cleanup: "Limpieza",
  backup: "Copia de seguridad",
  report_daily: "Informe diario",
  report_weekly: "Informe semanal",
  report_monthly: "Informe mensual",
};

async function Content() {
  const { supabase } = await getSession();
  const [tasksRes, projectsRes, jobsRes, linksRes] = await Promise.all([
    supabase.from("tasks").select("id,title,status,priority,due_date,completed_at,project_id,is_demo").neq("status", "cancelled").order("due_date", { ascending: true, nullsFirst: false }).order("priority").order("position"),
    supabase.from("projects").select("id,name,status,color,is_demo").eq("status", "active").order("created_at"),
    supabase.from("job_runs").select("id,job_name,status,started_at,items,error,details").gte("started_at", isoDaysAgo(7)).order("started_at", { ascending: false }).limit(1000),
    supabase.from("kb_links").select("id,entity_type,entity_id,kb_documents(title,source_url,external_id,deleted_at)").limit(1000),
  ]);

  const tasks = tasksRes.data ?? [];
  const projects = projectsRes.data ?? [];
  // Último estado de cada tarea y errores de los últimos 7 días
  const runs = jobsRes.data ?? [];
  const latest = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!latest.has(r.job_name)) latest.set(r.job_name, r);
  const lastJobs = [...latest.values()].sort((a, b) => (JOB_LABEL[a.job_name] ?? a.job_name).localeCompare(JOB_LABEL[b.job_name] ?? b.job_name, "es"));
  const errors7d = new Map<string, number>();
  for (const r of runs) if (r.status === "error") errors7d.set(r.job_name, (errors7d.get(r.job_name) ?? 0) + 1);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));
  const today = todayISO();

  // Documentos de Craft vinculados, por tarea o proyecto
  const docsFor = new Map<string, DocLink[]>();
  for (const l of linksRes.data ?? []) {
    const d = l.kb_documents;
    if (!d || d.deleted_at) continue;
    const key = `${l.entity_type}:${l.entity_id}`;
    docsFor.set(key, [...(docsFor.get(key) ?? []), { title: d.title, href: d.source_url ?? craftUrl(d.external_id) }]);
  }

  const open = tasks.filter((t) => t.status !== "done");
  const groups = [
    { key: "overdue", label: "Vencidas", items: open.filter((t) => t.due_date && t.due_date < today) },
    { key: "today", label: "Hoy", items: open.filter((t) => t.due_date === today) },
    { key: "upcoming", label: "Próximas", items: open.filter((t) => t.due_date && t.due_date > today) },
    { key: "someday", label: "Sin fecha", items: open.filter((t) => !t.due_date) },
  ].filter((g) => g.items.length > 0);
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .slice(0, 6);
  const anyDemo = tasks.some((t) => t.is_demo) || projects.some((p) => p.is_demo);
  const jobsDemo = lastJobs.some((j) => (j.details as { demo?: boolean } | null)?.demo);

  return (
    <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
      <Card className="lg:col-span-4">
        <CardTitle action={<DemoBadge show={anyDemo} />}>Tareas</CardTitle>

        <form action={addTask} className="mb-5 grid grid-cols-2 gap-3 border-b border-line pb-5 xl:grid-cols-[1fr_auto_auto_auto_auto]">
          <div className="col-span-2 flex flex-col gap-2 xl:col-span-1">
            <label htmlFor="title" className="text-[12px] font-medium text-ink-3">Nueva tarea</label>
            <input id="title" name="title" required maxLength={200} placeholder="Qué hay que hacer" autoComplete="off"
              className="h-11 rounded-xl border border-line bg-bg px-3 text-[16px] outline-none focus:border-accent" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="project_id" className="text-[12px] font-medium text-ink-3">Proyecto</label>
            <select id="project_id" name="project_id" defaultValue="" className="h-11 rounded-xl border border-line bg-bg px-2 text-[15px] outline-none focus:border-accent">
              <option value="">Ninguno</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="priority" className="text-[12px] font-medium text-ink-3">Prioridad</label>
            <select id="priority" name="priority" defaultValue="2" className="h-11 rounded-xl border border-line bg-bg px-2 text-[15px] outline-none focus:border-accent">
              {[1, 2, 3, 4].map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="due_date" className="text-[12px] font-medium text-ink-3">Fecha</label>
            <input id="due_date" name="due_date" type="date" className="h-11 rounded-xl border border-line bg-bg px-2 text-[15px] outline-none focus:border-accent" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="press flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-[15px] font-semibold text-white">
              <Plus size={17} strokeWidth={2.4} aria-hidden /> Añadir
            </button>
          </div>
        </form>

        {groups.length === 0 ? (
          <Empty title="Nada pendiente" hint="Añade la primera tarea con el formulario de arriba." />
        ) : (
          groups.map((g) => (
            <div key={g.key} className="mb-4 last:mb-0">
              <p className={`mb-1 text-[13px] font-semibold ${g.key === "overdue" ? "text-bad" : "text-ink-2"}`}>
                {g.label} <span className="tnum font-normal text-ink-3">{g.items.length}</span>
              </p>
              <ul className="divide-y divide-line">
                {g.items.map((t) => (
                  <TaskRow
                    key={t.id} id={t.id} title={t.title} done={false}
                    meta={[t.project_id ? projectName.get(t.project_id) : null, `Prioridad ${PRIORITY[t.priority].toLowerCase()}`].filter(Boolean).join(" · ")}
                    badge={t.due_date ? dayShort(t.due_date) : undefined}
                    badgeTone={g.key === "overdue" ? "bad" : "neutral"}
                    docs={docsFor.get(`task:${t.id}`)}
                    fields={{ projectId: t.project_id, priority: t.priority, dueDate: t.due_date }} projects={projectOptions}
                  />
                ))}
              </ul>
            </div>
          ))
        )}

        {done.length > 0 ? (
          <div className="mt-6 border-t border-line pt-4">
            <p className="mb-1 text-[13px] font-semibold text-ink-2">Completadas recientemente</p>
            <ul className="divide-y divide-line">
              {done.map((t) => (
                <TaskRow key={t.id} id={t.id} title={t.title} done meta={t.completed_at ? relative(t.completed_at) : undefined} docs={docsFor.get(`task:${t.id}`)} fields={{ projectId: t.project_id, priority: t.priority, dueDate: t.due_date }} projects={projectOptions} />
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardTitle>Proyectos</CardTitle>
          {projects.length === 0 ? (
            <Empty title="Sin proyectos" />
          ) : (
            <ul className="flex flex-col gap-3">
              {projects.map((p) => {
                const mine = tasks.filter((t) => t.project_id === p.id);
                const closed = mine.filter((t) => t.status === "done").length;
                const pct = mine.length ? Math.round((closed / mine.length) * 100) : 0;
                return (
                  <li key={p.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[15px] font-medium">{p.name}</p>
                      <p className="tnum shrink-0 text-[12px] text-ink-3">{closed}/{mine.length}</p>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${pct}% completado`}>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <DocLinks docs={docsFor.get(`project:${p.id}`)} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle action={<DemoBadge show={jobsDemo} />}>Automatizaciones</CardTitle>
          {lastJobs.length === 0 ? (
            <Empty title="Sin ejecuciones en los últimos 7 días" hint="Las ejecuta el worker del Mac mini." />
          ) : (
            <ul className="flex flex-col gap-3">
              {lastJobs.map((j) => (
                <li key={j.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-medium">{JOB_LABEL[j.job_name] ?? j.job_name}</p>
                    <Pill tone={j.status === "ok" ? "good" : j.status === "error" ? "bad" : "neutral"}>
                      {j.status === "ok" ? "Correcto" : j.status === "error" ? "Error" : j.status === "running" ? "En curso" : "Omitido"}
                    </Pill>
                  </div>
                  <p className="text-[12px] text-ink-3">
                    {relative(j.started_at)}
                    {j.status === "error" && j.error ? ` · ${j.error}` : ""}
                    {errors7d.get(j.job_name) ? ` · ${errors7d.get(j.job_name)} ${errors7d.get(j.job_name) === 1 ? "error" : "errores"} en 7 días` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, PageHeader, Pill, SkeletonGrid } from "@/components/ui";
import { loadSettings, MODELS, SOURCE_KEYS, STYLES } from "@/lib/assistant-settings";
import { relative, todayISO } from "@/lib/format";

/** Medianoche de hoy en Madrid, en UTC (vale en horario de verano y de invierno). */
function madridMidnight() {
  const [y, m, d] = todayISO().split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const wall = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "Europe/Madrid" })).getTime();
  const utcWall = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(guess - (wall - utcWall)).toISOString();
}
import { restoreSettings, saveSettings } from "../actions";

export const metadata: Metadata = { title: "Configuración del asistente" };

const FIELD = "w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-[15px] outline-none focus:border-accent";
const LABEL = "text-[13px] font-medium text-ink-2";

export default function ConfiguracionPage({ searchParams }: PageProps<"/asistente/configuracion">) {
  const saved = searchParams.then((p) => p.guardado === "1");
  return (
    <>
      <PageHeader title="Configuración del asistente" subtitle="Cómo responde, qué consulta y cuánto puede gastar al día.">
        <Link href="/asistente" className="press flex items-center gap-1 text-[14px] font-medium text-accent">
          <ChevronLeft size={16} aria-hidden /> Asistente
        </Link>
      </PageHeader>
      <Suspense fallback={<SkeletonGrid blocks={3} />}>
        <Content saved={saved} />
      </Suspense>
    </>
  );
}

async function Content({ saved }: { saved: Promise<boolean> }) {
  const justSaved = await saved;
  const { supabase } = await getSession();
  const [s, historyRes, usageRes] = await Promise.all([
    loadSettings(supabase),
    supabase.from("assistant_settings").select("version,note,created_at,style,model_quick,model_reports,daily_cap").order("version", { ascending: false }).limit(20),
    supabase.from("ai_jobs").select("id", { count: "exact", head: true }).gte("created_at", madridMidnight()),
  ]);
  const history = historyRes.data ?? [];
  const used = usageRes.count ?? 0;

  return (
    <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
      <Card className="lg:col-span-4">
        <CardTitle action={s.version ? <Pill>Versión {s.version}</Pill> : <Pill>Sin guardar</Pill>}>Ajustes</CardTitle>
        {justSaved ? <p className="mb-4 rounded-xl bg-accent-soft px-3 py-2 text-[14px] text-accent">Guardado como versión {s.version}.</p> : null}

        <form action={saveSettings} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="instructions" className={LABEL}>Instrucciones generales</label>
            <textarea id="instructions" name="instructions" defaultValue={s.instructions} rows={7} maxLength={8000}
              placeholder="Por ejemplo: tutéame; cuando hable de running dame ritmos en min/km; si algo depende de mi turno en Renault, tenlo en cuenta…"
              className={`${FIELD} py-2 leading-relaxed`} />
            <p className="text-[12px] text-ink-3">Tu contexto personal (familia, trabajo, preferencias) ya lo lee de «🧠 Memoria e Información Importante» en Craft; no hace falta repetirlo aquí.</p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className={`${LABEL} mb-2`}>Estilo de respuesta</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {STYLES.map((o) => (
                <label key={o.value} className="press flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <input type="radio" name="style" value={o.value} defaultChecked={s.style === o.value} className="mt-1 accent-[var(--accent)]" />
                  <span><span className="block text-[14px] font-medium">{o.label}</span><span className="block text-[12px] text-ink-3">{o.hint}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className={`${LABEL} mb-2`}>Fuentes que puede consultar</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SOURCE_KEYS.map((o) => (
                <label key={o.key} className="press flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 has-[:checked]:border-accent">
                  <input type="checkbox" name={`source_${o.key}`} defaultChecked={s.sources[o.key]} className="mt-1 accent-[var(--accent)]" />
                  <span><span className="block text-[14px] font-medium">{o.label}</span><span className="block text-[12px] text-ink-3">{o.hint}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2">
              <span className={LABEL}>Modelo para preguntas</span>
              <select name="model_quick" defaultValue={s.model_quick} className={`${FIELD} h-11`}>
                {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label} · {m.hint}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className={LABEL}>Modelo para informes</span>
              <select name="model_reports" defaultValue={s.model_reports} className={`${FIELD} h-11`}>
                {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label} · {m.hint}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className={LABEL}>Tope diario de trabajos</span>
              <input type="number" name="daily_cap" min={0} max={200} defaultValue={s.daily_cap} className={`${FIELD} tnum h-11`} />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="shortcuts" className={LABEL}>Atajos de preguntas frecuentes</label>
            <textarea id="shortcuts" name="shortcuts" defaultValue={s.shortcuts.join("\n")} rows={4}
              placeholder={"Una por línea, hasta 12. Por ejemplo:\n¿Qué tengo mañana?\n¿Cómo voy de forma?"}
              className={`${FIELD} py-2 leading-relaxed`} />
            <p className="text-[12px] text-ink-3">Aparecen como botones en el Asistente.</p>
          </div>

          <div className="flex justify-end border-t border-line pt-4">
            <button type="submit" className="press h-11 rounded-xl bg-accent px-5 text-[15px] font-semibold text-white">Guardar como versión {s.version + 1}</button>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardTitle>Uso de hoy</CardTitle>
          <p className="tnum text-[40px] font-semibold leading-none tracking-tight">
            {used}<span className="ml-1 text-[15px] font-medium text-ink-3">de {s.daily_cap}</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${used} de ${s.daily_cap} trabajos hoy`}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${s.daily_cap ? Math.min(100, (used / s.daily_cap) * 100) : 0}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-ink-3">Trabajos de IA lanzados hoy. Las preguntas rápidas sin IA no cuentan. La IA aún no está activa (F5-3).</p>
        </Card>

        <Card>
          <CardTitle>Lo que no se puede cambiar</CardTitle>
          <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-2">
            {[
              "Los permisos: el asistente solo lee, con herramientas que fija el worker.",
              "El origen de las cifras: siempre salen de consultas, no de la IA.",
              "Las reglas del proyecto (Craft de solo lectura salvo la tabla Seguimiento, secretos fuera de la web…).",
            ].map((t) => (
              <li key={t} className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-good" aria-hidden />{t}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Historial</CardTitle>
          {history.length === 0 ? (
            <p className="text-[13px] text-ink-3">Aún no has guardado ninguna versión: se usan los valores por defecto.</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.version} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">Versión {h.version}{h.version === s.version ? <span className="ml-1.5 text-[12px] font-normal text-accent">vigente</span> : null}</p>
                    <p className="truncate text-[12px] text-ink-3">{[relative(h.created_at), h.note, `${h.style} · ${h.model_quick}/${h.model_reports} · tope ${h.daily_cap}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  {h.version !== s.version ? (
                    <form action={restoreSettings}>
                      <input type="hidden" name="version" value={h.version} />
                      <button type="submit" className="press shrink-0 rounded-lg border border-line px-2.5 py-1 text-[13px] font-medium text-ink-2 hover:border-accent">Restaurar</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

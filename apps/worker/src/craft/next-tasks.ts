/**
 * Tareas para mañana: las que Marcos deja en el «📝 Cierre del día» del Informe Diario de
 * Craft (sección «Tareas para mañana») pasan a la tabla tasks del Hub, con fecha del día
 * siguiente al del informe. Craft solo se lee.
 *
 * - Lee el informe de hoy y, solo antes de las 12:00, también el de ayer (por si el Mac estuvo
 *   dormido a la hora programada).
 * - Solo las tareas sin marcar («- [ ] …») y con texto; las marcadas o vacías se ignoran.
 * - Sin duplicados: cada tarea lleva en notas su origen («Cierre del día AAAA-MM-DD · Craft»)
 *   y no se vuelve a crear si ya existe una con el mismo título, fecha y origen (aunque esté
 *   completada). Si se borra en el Hub, podría reaparecer mientras su informe sea de hoy o ayer.
 *
 *   npm run craft:tasks --workspace apps/worker                 crea las tareas
 *   npm run craft:tasks --workspace apps/worker -- --dry-run    solo muestra qué crearía
 */
import type pg from "pg";
import { USER_ID } from "../db.ts";
import { runJob, type JobResult } from "../jobs.ts";
import { craft, titleDate } from "./extras.ts";

const NEWS_FOLDER_PATH = "NOTICIAS / 📰 Informe Diario";
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu;
const clean = (s: string) => s.replace(EMOJI, "").replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();

function madridToday() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
}

function addDays(isoDate: string, n: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Extrae las tareas pendientes de la sección «Tareas para mañana» de un informe en markdown. */
export function parseNextTasks(markdown: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /tareas para mañana/i.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const t = line.trim();
    if (!t) continue;
    // Fin de la sección: otro título en negrita («**🛒 Para la lista…**») o un encabezado
    if (/^#{1,6}\s/.test(t) || /^\*\*.+\*\*:?$/.test(t)) break;
    const m = t.match(/^[-*]\s+\[( |x|X)\]\s*(.*)$/);
    if (!m || m[1] !== " ") continue;
    const title = clean(m[2]);
    if (title) out.push(title);
  }
  return out;
}

export async function importNextTasks(db: pg.Client, opts: { dryRun?: boolean } = {}): Promise<JobResult> {
  const uid = USER_ID();
  const today = madridToday();
  const { rows } = await db.query<{ external_id: string; title: string }>(
    `select external_id, title from public.kb_documents
      where user_id = $1 and deleted_at is null and folder_path = $2
      order by source_updated_at desc nulls last limit 15`,
    [uid, NEWS_FOLDER_PATH],
  );
  const reports = rows
    .map((r) => ({ ...r, date: titleDate(r.title) }))
    .filter((r): r is typeof r & { date: string } => !!r.date && (r.date === today || r.date === addDays(today, -1)))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!reports.length) return { status: "skipped", items: 0, message: "sin informe de hoy ni de ayer en el índice de Craft" };

  const created: { title: string; due_date: string }[] = [];
  const existing: string[] = [];
  // El informe de ayer solo cuenta por la mañana (puesta al día si el Mac durmió a las 23:45);
  // más tarde sus tareas, que eran para hoy, ya estarían gestionadas o caducadas.
  const hour = Number(new Date().toLocaleString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }));
  for (const rep of reports) {
    const due = addDays(rep.date, 1);
    if (due < today || (due === today && hour >= 12)) continue;
    const md = await (await craft("/blocks", { id: rep.external_id }, "text/markdown")).text();
    const source = `Cierre del día ${rep.date} · Craft`;
    for (const title of parseNextTasks(md)) {
      const dup = await db.query(
        "select 1 from public.tasks where user_id = $1 and title = $2 and due_date = $3 and notes = $4",
        [uid, title, due, source],
      );
      if (dup.rowCount) {
        existing.push(title);
        continue;
      }
      if (!opts.dryRun) {
        await db.query(
          "insert into public.tasks (user_id, title, notes, due_date, priority) values ($1, $2, $3, $4, 2)",
          [uid, title, source, due],
        );
      }
      created.push({ title, due_date: due });
    }
  }
  const verb = opts.dryRun ? "crearía" : "creadas";
  return {
    items: created.length,
    details: { reports: reports.map((r) => r.date), created, existing: existing.length, dryRun: !!opts.dryRun },
    message: `${created.length} tareas ${verb}${existing.length ? ` · ${existing.length} ya estaban` : ""}`,
  };
}

if (import.meta.main) {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    // En seco no se registra en job_runs: solo se muestra el resultado
    const { connect } = await import("../db.ts");
    const db = await connect();
    try {
      console.log(JSON.stringify(await importNextTasks(db, { dryRun: true }), null, 2));
    } finally {
      await db.end();
    }
  } else {
    const r = await runJob("craft_next_tasks", importNextTasks);
    process.exit(r.ok ? 0 : 1);
  }
}

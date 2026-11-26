"use server";

import { refresh } from "next/cache";
import { getSession } from "@/lib/supabase/server";
import { TRACKING_STATUSES } from "@/lib/tracking";

export async function addTask(formData: FormData) {
  const { supabase } = await getSession();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const project = String(formData.get("project_id") ?? "");
  const due = String(formData.get("due_date") ?? "");
  const priority = Number(formData.get("priority") ?? 2);
  await supabase.from("tasks").insert({
    title: title.slice(0, 200),
    project_id: project || null,
    due_date: due || null,
    priority: priority >= 1 && priority <= 4 ? priority : 2,
  });
  refresh();
}

export async function toggleTask(formData: FormData) {
  const { supabase } = await getSession();
  const id = String(formData.get("id") ?? "");
  const done = formData.get("done") === "true";
  if (!id) return;
  const { data } = await supabase
    .from("tasks")
    .update({ status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .select("title")
    .maybeSingle();
  if (done && data) {
    await supabase.from("activity_log").insert({ kind: "task_done", title: data.title, entity_type: "task", entity_id: id });
  }
  refresh();
}

export async function deleteTask(formData: FormData) {
  const { supabase } = await getSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("tasks").delete().eq("id", id);
  refresh();
}

export async function updateTask(formData: FormData) {
  const { supabase } = await getSession();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!id || !title) return;
  const project = String(formData.get("project_id") ?? "");
  const due = String(formData.get("due_date") ?? "");
  const priority = Number(formData.get("priority") ?? 2);
  await supabase
    .from("tasks")
    .update({
      title: title.slice(0, 200),
      project_id: project || null,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
      priority: priority >= 1 && priority <= 4 ? priority : 2,
    })
    .eq("id", id);
  refresh();
}

// ---------- Proyectos ----------
// La web solo crea y cambia el proyecto en la base de datos. La carpeta y la «Ficha del
// proyecto» en Craft las crea y mantiene el worker (apps/worker/src/craft/projects.ts).

const PROJECT_STATUSES = ["active", "paused", "done", "archived"] as const;

export async function createProject(formData: FormData) {
  const { supabase } = await getSession();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return;
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000);
  await supabase.from("projects").insert({ name, description: description || null });
  refresh();
}

export async function updateProject(formData: FormData) {
  const { supabase } = await getSession();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!id || !name) return;
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000);
  await supabase.from("projects").update({ name, description: description || null }).eq("id", id);
  refresh();
}

export async function setProjectStatus(formData: FormData) {
  const { supabase } = await getSession();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(PROJECT_STATUSES as readonly string[]).includes(status)) return;
  await supabase.from("projects").update({ status }).eq("id", id);
  refresh();
}

// ---------- Seguimiento de Craft ----------
// La web no escribe en Craft: deja el cambio en una cola y el worker lo aplica (ver la migración
// 20261121100000_craft_tracking_changes.sql). Solo título, categoría, estado, fecha y notas.

type TrackingFields = { title: string; category: string | null; status: string | null; due_date: string | null; notes: string | null };

async function queueTracking(externalId: string, wanted: Partial<TrackingFields>) {
  const { supabase } = await getSession();
  const { data: row } = await supabase
    .from("craft_tracking")
    .select("title,category,status,due_date,notes")
    .eq("external_id", externalId)
    .maybeSingle();
  if (!row) return;
  const base: TrackingFields = { title: row.title, category: row.category, status: row.status, due_date: row.due_date, notes: row.notes };
  const changes: Partial<TrackingFields> = {};
  for (const [k, v] of Object.entries(wanted) as [keyof TrackingFields, string | null][]) {
    if (v === undefined) continue;
    if ((v ?? null) !== (base[k] ?? null)) (changes as Record<string, string | null>)[k] = v;
  }
  if (Object.keys(changes).length === 0) return;
  await supabase.from("craft_tracking_changes").insert({ external_id: externalId, changes, base });
  refresh();
}

export async function updateTracking(formData: FormData) {
  const id = String(formData.get("external_id") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 300);
  const status = String(formData.get("status") ?? "");
  const due = String(formData.get("due_date") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 10_000);
  if (!id || !title || !(TRACKING_STATUSES as readonly string[]).includes(status)) return;
  // La API de Craft no permite vaciar estos campos: vacío significa «no cambiar»
  await queueTracking(id, {
    title,
    status,
    category: category || undefined,
    due_date: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : undefined,
    notes: notes || undefined,
  });
}

export async function setTrackingStatus(formData: FormData) {
  const id = String(formData.get("external_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(TRACKING_STATUSES as readonly string[]).includes(status)) return;
  await queueTracking(id, { status });
}

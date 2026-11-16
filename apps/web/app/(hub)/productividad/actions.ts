"use server";

import { refresh } from "next/cache";
import { getSession } from "@/lib/supabase/server";

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

"use server";

import { refresh } from "next/cache";
import { getSession } from "@/lib/supabase/server";

/** Vincula un documento de Craft con una tarea o un proyecto. `target` llega como "task:<id>" o "project:<id>". */
export async function linkDocument(formData: FormData) {
  const { supabase } = await getSession();
  const documentId = String(formData.get("document_id") ?? "");
  const [type, entityId] = String(formData.get("target") ?? "").split(":");
  if (!documentId || !entityId || (type !== "task" && type !== "project")) return;

  // Con RLS, solo se encuentran el documento y la tarea o el proyecto del propio usuario
  const [doc, entity] = await Promise.all([
    supabase.from("kb_documents").select("id").eq("id", documentId).maybeSingle(),
    supabase.from(type === "task" ? "tasks" : "projects").select("id").eq("id", entityId).maybeSingle(),
  ]);
  if (!doc.data || !entity.data) return;

  await supabase
    .from("kb_links")
    .upsert({ document_id: documentId, entity_type: type, entity_id: entityId, created_by: "user" }, { onConflict: "document_id,entity_type,entity_id", ignoreDuplicates: true });
  refresh();
}

export async function unlinkDocument(formData: FormData) {
  const { supabase } = await getSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("kb_links").delete().eq("id", id);
  refresh();
}

"use server";

import { refresh } from "next/cache";
import { getSession } from "@/lib/supabase/server";

export async function addSource(formData: FormData) {
  const { supabase } = await getSession();
  const name = String(formData.get("name") ?? "").trim();
  let url = String(formData.get("url") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!name || !url) return;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    new URL(url);
  } catch {
    return;
  }
  await supabase.from("web_sources").insert({ name: name.slice(0, 120), url, category: category.slice(0, 60) || null, kind: "bookmark" });
  refresh();
}

export async function toggleFavorite(formData: FormData) {
  const { supabase } = await getSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("web_sources").update({ is_favorite: formData.get("favorite") === "true" }).eq("id", id);
  refresh();
}

export async function deleteSource(formData: FormData) {
  const { supabase } = await getSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("web_sources").delete().eq("id", id);
  refresh();
}

/** Marca una lectura como guardada o leída (son las dos únicas columnas que la web puede cambiar). */
export async function setItemFlag(formData: FormData) {
  const { supabase } = await getSession();
  const id = String(formData.get("id") ?? "");
  const field = String(formData.get("field") ?? "");
  const value = formData.get("value") === "true";
  if (!id) return;
  if (field === "is_saved") await supabase.from("web_items").update({ is_saved: value }).eq("id", id);
  else if (field === "is_read") await supabase.from("web_items").update({ is_read: value }).eq("id", id);
  refresh();
}

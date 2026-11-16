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

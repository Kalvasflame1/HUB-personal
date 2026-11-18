"use server";

import { refresh } from "next/cache";
import { getSession } from "@/lib/supabase/server";

/** Marca un aviso como leído; con id="all", todos los pendientes. Solo cambia read_at. */
export async function markNotificationRead(formData: FormData) {
  const { supabase } = await getSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  await (id === "all" ? query : query.eq("id", id));
  refresh();
}

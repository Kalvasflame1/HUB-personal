"use server";

import { refresh } from "next/cache";
import { getSession } from "@/lib/supabase/server";

export type TokenState = { token?: string; error?: string };

/** Crea una clave nueva del widget (revoca la anterior). Se devuelve una sola vez y no se guarda en claro. */
export async function createWidgetToken(): Promise<TokenState> {
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("create_widget_token");
  if (error || !data) return { error: "No se pudo crear la clave. Inténtalo de nuevo." };
  refresh();
  return { token: data };
}

/** Revoca la clave activa: el widget y el atajo dejan de funcionar hasta crear otra. */
export async function revokeWidgetToken() {
  const { supabase } = await getSession();
  await supabase.rpc("revoke_widget_tokens");
  refresh();
}

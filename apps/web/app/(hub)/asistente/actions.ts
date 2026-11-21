"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getSession } from "@/lib/supabase/server";
import { MODELS, SOURCE_KEYS, STYLES } from "@/lib/assistant-settings";

const oneOf = <T extends string>(v: unknown, allowed: readonly { value: T }[], fallback: T) =>
  (allowed.find((a) => a.value === v)?.value ?? fallback) as T;

async function nextVersion() {
  const { supabase } = await getSession();
  const { data } = await supabase.from("assistant_settings").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
  return { supabase, version: (data?.version ?? 0) + 1 };
}

/** Guarda la configuración como una versión nueva (nunca se sobrescribe la anterior). */
export async function saveSettings(formData: FormData) {
  const { supabase, version } = await nextVersion();
  const cap = Number(formData.get("daily_cap"));
  const shortcuts = String(formData.get("shortcuts") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => s.slice(0, 160));
  await supabase.from("assistant_settings").insert({
    version,
    instructions: String(formData.get("instructions") ?? "").trim().slice(0, 8000),
    style: oneOf(formData.get("style"), STYLES, "normal"),
    sources: Object.fromEntries(SOURCE_KEYS.map((s) => [s.key, formData.get(`source_${s.key}`) === "on"])),
    model_quick: oneOf(formData.get("model_quick"), MODELS, "haiku"),
    model_reports: oneOf(formData.get("model_reports"), MODELS, "sonnet"),
    daily_cap: Number.isFinite(cap) ? Math.min(200, Math.max(0, Math.round(cap))) : 20,
    shortcuts,
  });
  redirect("/asistente/configuracion?guardado=1");
}

/** Restaura una versión anterior guardándola como versión nueva. */
export async function restoreSettings(formData: FormData) {
  const from = Number(formData.get("version"));
  const { supabase, version } = await nextVersion();
  const { data: old } = await supabase
    .from("assistant_settings")
    .select("instructions,style,sources,model_quick,model_reports,daily_cap,shortcuts")
    .eq("version", from)
    .maybeSingle();
  if (!old) return;
  await supabase.from("assistant_settings").insert({ ...old, version, note: `Restaurada la versión ${from}` });
  refresh();
}

/** Encola la pregunta para Claude en el Mac mini y vuelve al Asistente esperando la respuesta. */
export async function askAi(formData: FormData) {
  const question = String(formData.get("q") ?? "").trim().slice(0, 1000);
  if (!question) redirect("/asistente");
  const { supabase } = await getSession();
  const { data, error } = await supabase.from("ai_jobs").insert({ kind: "assistant", input: { question } }).select("id").single();
  if (error || !data) redirect(`/asistente?q=${encodeURIComponent(question)}&ia=error`);
  redirect(`/asistente?q=${encodeURIComponent(question)}&job=${data.id}`);
}

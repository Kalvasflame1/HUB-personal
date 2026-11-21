import type { getSession } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof getSession>>["supabase"];

export const SOURCE_KEYS = [
  { key: "tasks", label: "Tareas y proyectos", hint: "Incluye el seguimiento de Craft" },
  { key: "running", label: "Running", hint: "Entrenamientos, marcas, forma" },
  { key: "reports", label: "Informes", hint: "Diarios, semanales y mensuales del Hub" },
  { key: "web", label: "Información web", hint: "Lecturas guardadas y fuentes" },
  { key: "craft", label: "Craft", hint: "Índice de documentos" },
  { key: "craft_personal", label: "Carpeta PERSONAL de Craft", hint: "Memoria, apuntes y listas personales" },
] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number]["key"];

export const MODELS = [
  { value: "haiku", label: "Haiku", hint: "rápido y ligero" },
  { value: "sonnet", label: "Sonnet", hint: "equilibrado" },
  { value: "opus", label: "Opus", hint: "el más capaz, consume más" },
] as const;

export const STYLES = [
  { value: "breve", label: "Breve", hint: "Lo esencial, en pocas líneas" },
  { value: "normal", label: "Normal", hint: "Respuesta y contexto justo" },
  { value: "detallado", label: "Detallado", hint: "Con explicación y desglose" },
] as const;

export type AssistantSettings = {
  version: number;
  instructions: string;
  style: string;
  sources: Record<SourceKey, boolean>;
  model_quick: string;
  model_reports: string;
  daily_cap: number;
  shortcuts: string[];
  note: string | null;
  created_at: string | null;
};

export const DEFAULT_SETTINGS: AssistantSettings = {
  version: 0,
  instructions: "",
  style: "normal",
  sources: { tasks: true, running: true, reports: true, web: true, craft: true, craft_personal: true },
  model_quick: "haiku",
  model_reports: "sonnet",
  daily_cap: 20,
  shortcuts: [],
  note: null,
  created_at: null,
};

/** Versión vigente (la más reciente) o los valores por defecto si aún no se ha guardado ninguna. */
export async function loadSettings(supabase: Client): Promise<AssistantSettings> {
  const { data } = await supabase
    .from("assistant_settings")
    .select("version,instructions,style,sources,model_quick,model_reports,daily_cap,shortcuts,note,created_at")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return { ...data, sources: { ...DEFAULT_SETTINGS.sources, ...(data.sources as Partial<Record<SourceKey, boolean>>) } };
}

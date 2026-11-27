// Nivel A de la base de conocimiento: accesos directos curados a mano.
// No hay sincronización con Craft; ver docs/KNOWLEDGE_BASE.md.

const SPACE_ID = "57b0381b-3107-7b28-4b8f-d05ffde1fe04";

export function craftUrl(blockId: string) {
  return `craftdocs://open?spaceId=${SPACE_ID}&blockId=${blockId}`;
}

export type KnowledgeLink = { title: string; note: string; href: string };

export const CRAFT_DOCS: KnowledgeLink[] = [
  { title: "Seguimiento activo", note: "Histórico Resúmenes · colección de seguimiento", href: craftUrl("6b67fea5-f7cf-1103-1c76-38da1e77efbc") },
  { title: "Coach Running · Cola de órdenes", note: "Sin clasificar", href: craftUrl("bf82c39f-99f3-39e8-e01f-df338716acac") },
  { title: "Apuntes pendientes", note: "Personal", href: craftUrl("096acea6-3228-b48c-ce24-1bdaed2a9f35") },
  { title: "Lista de la compra", note: "Personal", href: craftUrl("e4704ed8-56b1-4eb4-257d-812493fc5780") },
  { title: "Voice memos inbox", note: "Personal", href: craftUrl("4A15051F-03A6-4A90-87A9-7EC49855B560") },
  { title: "Black Friday 2026", note: "Sin clasificar", href: craftUrl("6705f357-ec5b-3541-8229-f11cd0dee5d7") },
];

export const CRAFT_FOLDERS: { name: string; count: number; kind: string }[] = [
  { name: "Noticias · Informe diario", count: 145, kind: "Informes generados" },
  { name: "Histórico resúmenes · Semanal", count: 27, kind: "Resúmenes generados" },
  { name: "Histórico resúmenes · Mensual", count: 6, kind: "Resúmenes generados" },
  { name: "Vehículos", count: 5, kind: "Fichas" },
  { name: "Viajes", count: 4, kind: "Planificación" },
  { name: "Personal", count: 4, kind: "Notas de trabajo" },
];

export const ARTIFACTS: KnowledgeLink[] = [
  { title: "Resumen diario", note: "Panel del resumen matutino", href: "https://claude.ai/artifact/7by2JhPLBpbrX2Z4gTAadV" },
  { title: "Coach Personal", note: "Entrenador de running", href: "https://claude.ai/artifact/RjVPPMAPLkNDXuysQ5ecvm" },
  { title: "Coach Chat", note: "Conversación con el coach", href: "https://claude.ai/artifact/1rJzxcVATNSSc47VuYrYUJ" },
  { title: "Taller del Resumen Diario", note: "Mejoras pendientes del resumen", href: "https://claude.ai/artifact/QoYVxvqW41xnuVF3aTcn4P" },
  { title: "Finanzas 2026 · Dashboard", note: "Finanzas", href: "https://claude.ai/artifact/TDf9GeDv7poGJ8Q3A1pSVQ" },
  { title: "Cartera 2026 · Dashboard", note: "Finanzas", href: "https://claude.ai/artifact/7WMjQSU2v6fVL226ThaVES" },
  { title: "Simulador de ahorro familiar", note: "Finanzas", href: "https://claude.ai/artifact/NFZWjFxk4Em1nDvWDuQ2ZD" },
];

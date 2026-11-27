import type { Metadata } from "next";
import { ChevronRight, LayoutDashboard, PiggyBank, TrendingUp, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ARTIFACTS } from "@/lib/knowledge";

export const metadata: Metadata = { title: "Finanzas" };

const ICONS: Record<string, LucideIcon> = {
  "Finanzas 2026 · Dashboard": LayoutDashboard,
  "Cartera 2026 · Dashboard": TrendingUp,
  "Simulador de ahorro familiar": PiggyBank,
};

const NOTES: Record<string, string> = {
  "Finanzas 2026 · Dashboard": "Gastos, ingresos, presupuesto y traspasos a la cartera",
  "Cartera 2026 · Dashboard": "Evolución de la cartera, posiciones y resultado de las ventas",
  "Simulador de ahorro familiar": "Escenarios de ahorro",
};

const LINKS = ARTIFACTS.filter((a) => a.note === "Finanzas");

export default function FinanzasPage() {
  return (
    <>
      <PageHeader title="Finanzas" subtitle="Accesos a los paneles de finanzas personales" />
      <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
        {LINKS.map(({ title, href }) => {
          const Icon = ICONS[title] ?? LayoutDashboard;
          return (
            <li key={href} className="border-b border-line last:border-b-0">
              <a href={href} target="_blank" rel="noopener noreferrer" className="press flex items-center gap-3 px-5 py-4 text-[16px]">
                <Icon size={20} className="text-accent" strokeWidth={1.8} aria-hidden />
                <span className="flex-1">
                  <span className="block">{title}</span>
                  {NOTES[title] ? <span className="block text-[13px] text-ink-3">{NOTES[title]}</span> : null}
                </span>
                <ChevronRight size={18} className="text-ink-3" aria-hidden />
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

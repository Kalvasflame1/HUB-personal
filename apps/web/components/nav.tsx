"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ListChecks, Activity, Globe, Sparkles, FileText, BookOpen, Ellipsis, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };

const ITEMS: Item[] = [
  { href: "/", label: "Inicio", icon: LayoutGrid },
  { href: "/productividad", label: "Productividad", icon: ListChecks },
  { href: "/running", label: "Running", icon: Activity },
  { href: "/web", label: "Información web", icon: Globe },
  { href: "/asistente", label: "Asistente", icon: Sparkles },
  { href: "/informes", label: "Informes", icon: FileText },
  { href: "/conocimiento", label: "Conocimiento", icon: BookOpen },
];

const TABS: Item[] = [
  ITEMS[0],
  { ...ITEMS[1], label: "Tareas" },
  ITEMS[2],
  ITEMS[4],
  { href: "/mas", label: "Más", icon: Ellipsis },
];

const MORE = ["/mas", "/web", "/informes", "/conocimiento"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Con rutas dinámicas la ruta solo se conoce en tiempo de ejecución: el layout envuelve
 *  Sidebar y TabBar en Suspense y usa la variante estática (sin elemento activo) como reserva. */
export function Sidebar() {
  return <SidebarLinks pathname={usePathname()} />;
}

export function SidebarLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`press flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] ${
              active ? "bg-accent-soft font-semibold text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar() {
  return <TabBarLinks pathname={usePathname()} />;
}

export function TabBarLinks({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/mas" ? MORE.some((p) => pathname.startsWith(p)) : isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`press flex min-h-[52px] flex-col items-center justify-center gap-0.5 pt-1.5 text-[10px] font-medium ${
                  active ? "text-accent" : "text-ink-3"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

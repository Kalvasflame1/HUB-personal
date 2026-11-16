import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight, FileText, Globe, LogOut } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { signOut } from "@/app/actions";

export const metadata: Metadata = { title: "Más" };

const LINKS = [
  { href: "/web", label: "Información web", icon: Globe },
  { href: "/informes", label: "Informes", icon: FileText },
  { href: "/conocimiento", label: "Conocimiento", icon: BookOpen },
];

export default function MasPage() {
  return (
    <>
      <PageHeader title="Más" />
      <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href} className="border-b border-line last:border-b-0">
            <Link href={href} className="press flex items-center gap-3 px-5 py-4 text-[16px]">
              <Icon size={20} className="text-accent" strokeWidth={1.8} aria-hidden />
              <span className="flex-1">{label}</span>
              <ChevronRight size={18} className="text-ink-3" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut} className="mt-4">
        <button type="submit" className="press flex w-full items-center gap-3 rounded-3xl border border-line bg-surface px-5 py-4 text-[16px] text-bad">
          <LogOut size={20} strokeWidth={1.8} aria-hidden />
          Cerrar sesión
        </button>
      </form>
    </>
  );
}

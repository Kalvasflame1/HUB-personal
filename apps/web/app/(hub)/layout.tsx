import { LogOut } from "lucide-react";
import { Sidebar, TabBar } from "@/components/nav";
import { signOut } from "@/app/actions";

export default function HubLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-[100dvh]">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r border-line bg-surface px-3 py-6 md:flex">
        <div>
          <p className="mb-6 px-3 text-[17px] font-bold tracking-tight">Personal Hub</p>
          <Sidebar />
        </div>
        <form action={signOut}>
          <button type="submit" className="press flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-ink-3 hover:bg-surface-2 hover:text-ink">
            <LogOut size={17} strokeWidth={1.8} aria-hidden />
            Cerrar sesión
          </button>
        </form>
      </aside>
      <div className="md:pl-60">
        <main
          className="mx-auto w-full max-w-6xl px-4 pb-28 md:px-8 md:pb-12"
          style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
        >
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}

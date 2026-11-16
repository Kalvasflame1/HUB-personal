import type { Metadata } from "next";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-[100dvh] grid-cols-1 md:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between border-r border-line bg-surface p-12 md:flex">
        <p className="text-[15px] font-semibold tracking-tight">Personal Hub</p>
        <div>
          <p className="max-w-md text-[40px] font-bold leading-[1.05] tracking-tight">
            Tu día, tus entrenamientos y tu conocimiento en un solo sitio.
          </p>
          <p className="mt-4 max-w-sm text-[15px] text-ink-2">Aplicación privada de un solo usuario.</p>
        </div>
        <p className="text-[12px] text-ink-3">Mac mini · Supabase · Craft · Strava</p>
      </section>
      <section className="flex flex-col justify-center px-6 py-12 md:px-16" style={{ paddingTop: "max(3rem, env(safe-area-inset-top))" }}>
        <div className="w-full max-w-sm">
          <p className="mb-8 text-[15px] font-semibold tracking-tight md:hidden">Personal Hub</p>
          <h1 className="text-[28px] font-bold tracking-tight">Entrar</h1>
          <p className="mb-8 mt-1 text-[15px] text-ink-2">Usa la cuenta que creaste en Supabase.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

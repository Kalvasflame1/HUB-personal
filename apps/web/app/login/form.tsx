"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-[13px] font-medium text-ink-2">Correo</label>
        <input
          id="email" name="email" type="email" required autoComplete="username" inputMode="email"
          className="h-12 rounded-xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-[13px] font-medium text-ink-2">Contraseña</label>
        <input
          id="password" name="password" type="password" required autoComplete="current-password"
          className="h-12 rounded-xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-accent"
        />
      </div>
      {state.error ? <p role="alert" className="text-[14px] text-bad">{state.error}</p> : null}
      <button
        type="submit" disabled={pending}
        className="press mt-1 h-12 rounded-xl bg-accent text-[16px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

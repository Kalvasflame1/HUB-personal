"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { createWidgetToken, type TokenState } from "@/app/(hub)/mas/widget/actions";

/** Botón de copiar al portapapeles con confirmación breve. */
export function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      className="press inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[14px] font-medium text-accent"
    >
      {done ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {done ? "Copiado" : label}
    </button>
  );
}

/** Crea la clave y la enseña una sola vez para copiarla. */
export function TokenForm({ hasToken }: { hasToken: boolean }) {
  const [state, action, pending] = useActionState<TokenState, FormData>(createWidgetToken, {});
  return (
    <div className="flex flex-col gap-3">
      {state.token ? (
        <div className="flex flex-col gap-2 rounded-xl bg-accent-soft p-3">
          <p className="text-[14px] text-ink">Copia la clave ahora: no se volverá a mostrar.</p>
          <code className="break-all rounded-lg bg-surface px-3 py-2 font-mono text-[13px]">{state.token}</code>
          <div><CopyButton value={state.token} label="Copiar clave" /></div>
        </div>
      ) : null}
      {state.error ? <p role="alert" className="text-[14px] text-bad">{state.error}</p> : null}
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          <KeyRound size={17} aria-hidden />
          {pending ? "Creando…" : hasToken ? "Crear una clave nueva" : "Crear la clave"}
        </button>
      </form>
      {hasToken && !state.token ? (
        <p className="text-[13px] text-ink-3">Al crear una nueva, la anterior deja de funcionar y tendrás que pegarla otra vez en Scriptable y en el atajo.</p>
      ) : null}
    </div>
  );
}

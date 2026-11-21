"use client";

import { useSyncExternalStore } from "react";
import { Headphones } from "lucide-react";

const SHORTCUT = "Elevenreader";
const noop = () => () => {};

/**
 * Botón «Escuchar con ElevenReader», solo en iPhone: abre el atajo del iPhone «Elevenreader»,
 * que lanza el reproductor de ElevenReader con el guion del podcast de hoy.
 * En el servidor, en el Mac y en el iPad no se muestra.
 */
export function ElevenReaderButton() {
  const isIphone = useSyncExternalStore(noop, () => /iPhone/.test(navigator.userAgent), () => false);
  if (!isIphone) return null;
  return (
    <a
      href={`shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT)}`}
      className="press mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-[15px] font-semibold text-ink-2"
    >
      <Headphones size={18} aria-hidden /> Escuchar con ElevenReader
    </a>
  );
}

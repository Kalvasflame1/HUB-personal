"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Mientras Claude responde, vuelve a pedir la página cada 2 s (hasta 3 minutos). */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 180_000) return clearInterval(timer);
      router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AiText } from "@/components/ai-text";

/** Quita los emojis (la interfaz no los usa); el texto del informe queda igual. */
export function noEmoji(s: string) {
  return s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu, "").replace(/\s{2,}/g, " ").trim();
}

type Section = { title: string; body: string };

/** Divide el informe por sus secciones «## ». */
export function sections(md: string): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  for (const line of md.split("\n")) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      cur = { title: noEmoji(h[1]), body: "" };
      out.push(cur);
    } else if (cur && !/^#\s/.test(line)) {
      cur.body += `${line}\n`;
    }
  }
  return out.map((s) => ({
    ...s,
    body: s.body
      .split("\n")
      .map((l) => {
        const lead = l.match(/^\s*(?:[-*]\s+(?:\[[ x]\]\s+)?)?/)?.[0] ?? "";
        return (lead + noEmoji(l.slice(lead.length))).replace(/^>\s?/, "");
      })
      .join("\n")
      .trim(),
  }));
}

const OPEN = /^(tiempo|agenda y pendientes)/i;
const SKIP = /^(próximos eventos|cierre del día)/i;

/** Informe Diario de Cowork en solo lectura: el tiempo y la agenda abiertos, el resto plegado. */
export function DailyReport({ markdown, sourceUrl }: { markdown: string; sourceUrl: string | null }) {
  const all = sections(markdown);
  const shown = all.filter((s) => !SKIP.test(s.title) && s.body);
  return (
    <div className="flex flex-col divide-y divide-line">
      {shown.map((s) => (
        <details key={s.title} open={OPEN.test(s.title)} className="group py-3 first:pt-0">
          <summary className="press flex cursor-pointer list-none items-center justify-between gap-2 text-[15px] font-semibold">
            {s.title}
            <span className="text-[12px] font-normal text-ink-3 group-open:hidden">Mostrar</span>
          </summary>
          <div className="mt-2"><AiText text={s.body} sources={[]} /></div>
        </details>
      ))}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-[13px]">
        <Link href="/productividad" className="font-medium text-accent">Próximos eventos en Productividad</Link>
        {sourceUrl ? (
          <a href={sourceUrl} className="inline-flex items-center gap-1 font-medium text-accent">
            Escribir el cierre del día en Craft <ExternalLink size={13} aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}

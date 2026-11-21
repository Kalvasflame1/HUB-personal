import type { ReactNode } from "react";

export type AiSource = { n: number; label: string; href?: string };

/**
 * Pinta la respuesta de Claude: párrafos, listas con «- », **negrita** y citas [n] como
 * enlaces a su fuente. No interpreta HTML ni otro Markdown.
 */
export function AiText({ text, sources }: { text: string; sources: AiSource[] }) {
  const byN = new Map(sources.map((s) => [s.n, s]));

  const inline = (line: string, key: string): ReactNode[] =>
    line.split(/(\*\*[^*]+\*\*|\[\d+\])/g).filter(Boolean).map((part, i) => {
      const k = `${key}-${i}`;
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={k} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
      const cite = part.match(/^\[(\d+)\]$/);
      if (cite) {
        const s = byN.get(Number(cite[1]));
        return (
          <sup key={k} className="ml-0.5 text-[11px] font-semibold text-accent">
            {s?.href ? <a href={s.href} title={s.label} className="hover:underline">{cite[1]}</a> : cite[1]}
          </sup>
        );
      }
      return part;
    });

  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    const items = list;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-4 list-disc space-y-1 marker:text-ink-3">
        {items.map((it, i) => <li key={i}>{inline(it, `li-${blocks.length}-${i}`)}</li>)}
      </ul>,
    );
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const item = line.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
    if (item) { list.push(item[1]); continue; }
    flush();
    if (line) blocks.push(<p key={`p-${blocks.length}`}>{inline(line.replace(/^#+\s*/, ""), `p-${blocks.length}`)}</p>);
  }
  flush();

  return <div className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-ink-2">{blocks}</div>;
}

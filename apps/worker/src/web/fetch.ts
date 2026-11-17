/**
 * Recogida de fuentes web (RSS/Atom).
 *
 * - Una fuente nueva (sin feed y nunca revisada) se visita una vez para descubrir su feed:
 *   si la propia dirección es un feed, o la página anuncia uno con <link rel="alternate">,
 *   se guarda y la fuente pasa a recogerse automáticamente.
 * - Las fuentes con feed activo se leen y sus entradas nuevas se guardan en web_items.
 * Un fallo en una fuente no para el resto; solo falla la tarea si fallan todas.
 *
 *   npm run web:fetch --workspace apps/worker
 */
import type pg from "pg";
import { XMLParser } from "fast-xml-parser";
import { USER_ID } from "../db.ts";
import { runJob, type JobResult } from "../jobs.ts";

const UA = "PersonalHub/0.1 (lector RSS de uso personal)";
const MAX_ITEMS = 30;
const COMMON_PATHS = ["/feed", "/rss", "/feed.xml", "/rss.xml", "/index.xml", "/atom.xml", "/feed/"];
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text", processEntities: true });

type Source = { id: string; name: string; url: string; feed_url: string | null; kind: string; fetch_enabled: boolean };
type Item = { url: string; title: string; excerpt: string | null; published_at: string | null };

async function get(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return { text: text.slice(0, 5_000_000), type: res.headers.get("content-type") ?? "", finalUrl: res.url };
}

const looksLikeFeed = (text: string) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)\b/i.test(text);

function discover(html: string, base: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel=["']?alternate/i.test(tag) || !/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) return new URL(href.replace(/&amp;/g, "&"), base).toString();
  }
  return null;
}

const text = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object" && "#text" in (v as object)) return text((v as Record<string, unknown>)["#text"]);
  return "";
};

const clean = (html: string, max: number) => {
  const plain = html
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
};

const date = (v: unknown) => {
  const d = new Date(text(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const list = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

export function parseFeed(xml: string, base: string): Item[] {
  const doc = parser.parse(xml) as Record<string, any>;
  const items: Item[] = [];
  const rssItems = list(doc.rss?.channel?.item ?? doc["rdf:RDF"]?.item);
  for (const it of rssItems) {
    const link = text(it.link) || text(it.guid);
    if (!link) continue;
    items.push({
      url: new URL(link, base).toString(),
      title: clean(text(it.title), 300) || "(sin título)",
      excerpt: clean(text(it.description ?? it["content:encoded"]), 300) || null,
      published_at: date(it.pubDate ?? it["dc:date"]),
    });
  }
  for (const e of list(doc.feed?.entry)) {
    const links = list(e.link) as Record<string, string>[];
    const href = (links.find((l) => !l["@rel"] || l["@rel"] === "alternate") ?? links[0])?.["@href"];
    if (!href) continue;
    items.push({
      url: new URL(href, base).toString(),
      title: clean(text(e.title), 300) || "(sin título)",
      excerpt: clean(text(e.summary ?? e.content), 300) || null,
      published_at: date(e.published ?? e.updated),
    });
  }
  return items
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
    .slice(0, MAX_ITEMS);
}

async function processSource(db: pg.Client, uid: string, s: Source) {
  let feedUrl = s.feed_url;
  let xml: string | null = null;

  if (!feedUrl) {
    const page = await get(s.url);
    if (looksLikeFeed(page.text)) {
      feedUrl = page.finalUrl;
      xml = page.text;
    } else {
      feedUrl = discover(page.text, page.finalUrl);
      // Si la página no anuncia su feed, se prueban las direcciones habituales
      for (const path of feedUrl ? [] : COMMON_PATHS) {
        const candidate = new URL(path, page.finalUrl).toString();
        const r = await get(candidate).catch(() => null);
        if (r && looksLikeFeed(r.text)) {
          feedUrl = r.finalUrl;
          xml = r.text;
          break;
        }
      }
    }
    if (!feedUrl) {
      await db.query("update public.web_sources set last_fetched_at = now() where id = $1", [s.id]);
      return { discovered: false, inserted: 0 };
    }
    await db.query(
      "update public.web_sources set feed_url = $2, kind = 'feed', fetch_enabled = true where id = $1",
      [s.id, feedUrl],
    );
  }

  xml ??= (await get(feedUrl)).text;
  const items = parseFeed(xml, feedUrl);
  let inserted = 0;
  for (const it of items) {
    const r = await db.query(
      `insert into public.web_items (user_id, source_id, url, title, excerpt, published_at)
       values ($1, $2, $3, $4, $5, $6) on conflict (source_id, url) do nothing`,
      [uid, s.id, it.url, it.title, it.excerpt, it.published_at],
    );
    inserted += r.rowCount ?? 0;
  }
  await db.query("update public.web_sources set last_fetched_at = now() where id = $1", [s.id]);
  return { discovered: !s.feed_url, inserted };
}

export async function fetchWeb(db: pg.Client): Promise<JobResult> {
  const uid = USER_ID();
  const { rows: sources } = await db.query<Source>(
    `select id, name, url, feed_url, kind, fetch_enabled from public.web_sources
      where user_id = $1 and not is_demo
        and ((feed_url is not null and fetch_enabled) or (feed_url is null and last_fetched_at is null))
      order by created_at`,
    [uid],
  );
  if (sources.length === 0) return { status: "skipped", items: 0, message: "Sin fuentes con feed", details: { sources: 0 } };

  let inserted = 0, discovered = 0;
  const errors: { source: string; error: string }[] = [];
  for (const s of sources) {
    try {
      const r = await processSource(db, uid, s);
      inserted += r.inserted;
      if (r.discovered) discovered++;
    } catch (e) {
      errors.push({ source: s.name, error: (e as Error).message });
    }
  }
  if (errors.length === sources.length) {
    throw new Error(`Todas las fuentes han fallado: ${errors.map((e) => `${e.source} (${e.error})`).join("; ")}`);
  }
  return {
    items: inserted,
    details: { sources: sources.length, discovered, errors },
    message: `${sources.length} fuentes, ${inserted} entradas nuevas${errors.length ? `, ${errors.length} con error` : ""}`,
  };
}

if (import.meta.main) {
  const r = await runJob("web_fetch", fetchWeb);
  if (!r.ok) process.exitCode = 1;
}

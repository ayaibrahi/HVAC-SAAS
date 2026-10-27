import { renderedLimits } from "./contract";

// Strict same-origin, default-port policy. This is NOT DNS/IP validation; the
// worker egress proxy must separately validate and pin every outbound connection.
export function sameSitePage(raw: string, base: string): string | null {
  try {
    if (raw.length > 2048) return null;
    const url = new URL(raw, base);
    const root = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== root.origin ||
        url.username || url.password || url.port || url.search) return null;
    if (/\.(?:pdf|zip|png|jpe?g|gif|svg|webp|mp4|xml|json|css|js)$/i.test(url.pathname)) return null;
    // Never follow action-shaped links even with GET, or private account pages.
    const path = decodeURIComponent(url.pathname);
    if (/(?:^|\/)(?:logout|signout|delete|remove|unsubscribe|checkout|cart|payment|login|admin|account)(?:\/|$)/i.test(path)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function pagePriority(url: string, label = '') {
  const path = new URL(url).pathname;
  if (path === '/') return 0;
  const text = `${path.replace(/[-_/]/g, ' ')} ${label}`.toLowerCase();
  if (/\b(service|services|heating|cooling|furnace|repair|hvac)\b/.test(text)) return 1;
  if (/\bcontact\b/.test(text)) return 2;
  if (/\b(quote|estimate)\b/.test(text)) return 3;
  if (/\b(book|booking|schedule|appointment)\b/.test(text)) return 4;
  return 9;
}

export function discoverPages(links: { href: string; text: string }[], base: string) {
  const pages = new Map<string, number>();
  for (const link of links.slice(0, renderedLimits.links)) {
    const url = sameSitePage(link.href, base);
    if (!url) continue;
    const priority = pagePriority(url, link.text);
    if (priority < 9) pages.set(url, Math.min(pages.get(url) ?? 9, priority));
  }
  return [...pages].map(([url, priority]) => ({ url, priority }))
    .sort((a, b) => a.priority - b.priority || a.url.localeCompare(b.url));
}

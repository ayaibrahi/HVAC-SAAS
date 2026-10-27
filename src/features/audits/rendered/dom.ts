import type { RenderedDocument } from "./contract";

// Self-contained callback for Playwright page.evaluate. Never inspect passwords,
// input values, cookies, localStorage, script bodies or hidden DOM text.
export function collectRenderedDocument(): RenderedDocument {
  const visible = (element: Element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    for (let p: Element | null = element; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || s.opacity === '0') return false;
    }
    return true;
  };
  let truncated = false;
  const bounded = (text: string, max: number) => {
    if (text.length > max) truncated = true;
    return text.replace(/\s+/g, ' ').trim().slice(0, max);
  };
  const elements = (selector: string, max: number) => {
    const all = document.querySelectorAll(selector);
    if (all.length > max) truncated = true;
    return Array.from(all).slice(0, max).filter(visible);
  };
  const label = (e: Element) => bounded(e.getAttribute('aria-label') ?? (e as HTMLElement).innerText ?? '', 240);
  const headings = elements('h1,h2', 20).map(label);
  const links = elements('a[href]', 100).map(e => ({ text: label(e), href: bounded((e as HTMLAnchorElement).href, 2048) }));
  const buttons = elements('button,[role="button"]', 30).filter(e => !e.hasAttribute('disabled') && e.getAttribute('aria-disabled') !== 'true').map(label);
  // Form controls are observed, never interacted with. No field values retained.
  const forms = elements('form', 10).filter(e => e.querySelector('input[type="email"],input[type="tel"],textarea')).map(label);
  const textNodes = elements('main p,article p,main li,article li,main h1,main h2,article h1,article h2', 300);
  const text = bounded(textNodes.map(e => (e as HTMLElement).innerText).join(' '), 30000);
  const title = bounded(document.title, 300);
  return { title, text, headings, links, buttons, forms, truncated };
}

// Escaped, inert projection for the existing deterministic parser. The original
// executable DOM is never stored or evaluated by the Next.js application.
export function projectRenderedDocument(document: RenderedDocument): string {
  const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  return `<html><head><title>${escape(document.title)}</title></head><body><main>` +
    document.headings.map(t => `<h2>${escape(t)}</h2>`).join('') + `<p>${escape(document.text)}</p>` +
    document.links.map(l => `<a href="${escape(l.href)}">${escape(l.text)}</a>`).join('') +
    document.buttons.map(t => `<button>${escape(t)}</button>`).join('') +
    document.forms.map(t => `<form>${escape(t)}<input type="email"></form>`).join('') +
    '</main></body></html>';
}

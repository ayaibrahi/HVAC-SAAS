import type { Page } from 'playwright-core';

export type EvidenceKind = 'cta' | 'phone' | 'contact' | 'booking' | 'form' | 'navigation';
export type Evidence = {
  kind: EvidenceKind;
  label: string;
  href: string | null;
  pageUrl: string;
  scope: 'analyzed_page';
  source: 'static_html_dom' | 'rendered_dom';
};
export type PageEvidence = {
  schemaVersion: 'rendered-fixture-0.1';
  requestedUrl: string;
  finalUrl: string;
  viewport: { width: number; height: number };
  source: Evidence['source'];
  status: 'complete_fixture' | 'incomplete';
  reasons: string[];
  evidence: Evidence[];
  signals: { phoneDetected: true | null; contactFormDetected: true | null; bookingElementDetected: true | null; ctaDetected: true | null };
  elapsedMs: number;
};

// Positive observations only. Neither a timeout nor an empty array asserts absence.
export async function extractVisibleEvidence(page: Page, source: Evidence['source']) {
  return page.evaluate(({ evidenceSource }) => {
    const nodes = Array.from(document.querySelectorAll('a,button,form,[role="button"]'));
    const truncated = nodes.length > 200;
    const evidence: Evidence[] = [];
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      for (let parent: Element | null = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
      }
      return true;
    };
    for (const element of nodes.slice(0, 200)) {
      if (!visible(element)) continue;
      const label = (element.getAttribute('aria-label') ?? (element as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
      const href = element instanceof HTMLAnchorElement ? element.href.slice(0, 2048) : null;
      const add = (kind: EvidenceKind) => evidence.push({ kind, label, href, pageUrl: location.href, scope: 'analyzed_page', source: evidenceSource });
      if (element instanceof HTMLFormElement) { add('form'); continue; }
      if (href?.startsWith('tel:')) add('phone');
      if (/\b(contact|call)\b/i.test(label) || href?.startsWith('mailto:')) add('contact');
      if (/\b(book|booking|schedule)\b/i.test(label)) add('booking');
      if (/\b(request|estimate|call|book|schedule|send)\b/i.test(label)) add('cta');
      if (href) {
        const target = new URL(href);
        if (target.origin === location.origin && ['/', '/services', '/contact'].includes(target.pathname) && !target.search && !target.hash) add('navigation');
      }
    }
    return { evidence: evidence.slice(0, 100), truncated: truncated || evidence.length > 100 };
  }, { evidenceSource: source });
}

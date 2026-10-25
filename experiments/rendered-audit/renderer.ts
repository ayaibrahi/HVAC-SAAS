import { chromium, errors, type BrowserContext, type Page } from 'playwright-core';
import { extractVisibleEvidence, type PageEvidence } from './extract.js';

const paths = new Set(['/', '/services', '/contact', '/timeout', '/broken', '/policy', '/redirect', '/fixture.js']);
export function isAllowedFixtureRequest(raw: string, origin: string, method = 'GET') {
  try {
    const url = new URL(raw);
    return method === 'GET' && url.origin === origin && url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' && !url.username && !url.password && !url.search && paths.has(url.pathname);
  } catch { return false; }
}

export async function startRenderer(origin: string) {
  const base = new URL(origin);
  if (base.origin !== origin || base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || !base.port) throw new Error('Fixture origin required');
  // Explicit allowlist: never pass application/DB/provider environment secrets to Chrome.
  const env: Record<string, string> = {};
  for (const key of ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'LOCALAPPDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)']) {
    const value = process.env[key]; if (value) env[key] = value;
  }
  if (process.platform === 'linux') {
    // Disposable CI container only; never inherit the runner's environment.
    env.HOME = '/tmp';
    env.TMPDIR = '/tmp';
    env.PATH = '/usr/local/bin:/usr/bin:/bin';
  }
  const server = await chromium.launchServer({
    channel: process.platform === 'win32' ? 'chrome' : 'chromium',
    headless: true, chromiumSandbox: true, timeout: 15000,
    host: '127.0.0.1', env,
    args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run'],
  });
  let browser;
  try { browser = await chromium.connect(server.wsEndpoint(), { timeout: 5000 }); }
  catch (error) { await server.close(); throw error; }
  const blocked: string[] = [];
  const contexts = new Set<BrowserContext>();
  const deadline = setTimeout(() => { void server.kill(); }, 45000);
  deadline.unref();
  let closed = false;
  return {
    browser, server, blocked, contexts,
    async session(viewport: { width: number; height: number }, javaScriptEnabled = true) {
      const context = await browser.newContext({ viewport, javaScriptEnabled, serviceWorkers: 'block', acceptDownloads: false });
      contexts.add(context);
      try {
        const sessionPage: { main?: Page } = {};
        await context.route('**/*', async (route) => {
          const request = route.request();
          const allowed = isAllowedFixtureRequest(request.url(), origin, request.method());
          const primaryPage = request.frame().page() === sessionPage.main;
          const primaryFrame = request.frame() === sessionPage.main?.mainFrame();
          if (!allowed || !primaryPage || !primaryFrame) {
            blocked.push('request_denied'); await route.abort('blockedbyclient'); return;
          }
          // Playwright's continue() can carry an allowed request across a redirect
          // without invoking this handler again. Inspect the response before the
          // browser sees it; this fixture prototype rejects ALL redirects.
          try {
            const response = await route.fetch({ maxRedirects: 0, timeout: 1500 });
            if (response.status() >= 300 && response.status() < 400) {
              blocked.push('redirect_denied'); await route.abort('blockedbyclient'); return;
            }
            const body = await response.body();
            if (body.byteLength > 131072) {
              blocked.push('fixture_response_limit'); await route.abort('blockedbyclient'); return;
            }
            await route.fulfill({ status: response.status(), body, headers: {
              'content-type': response.headers()['content-type'] ?? 'application/octet-stream',
              'cache-control': 'no-store',
            } });
          } catch {
            blocked.push('fixture_fetch_failed'); await route.abort('failed').catch(() => {});
          }
        });
        await context.routeWebSocket('**/*', (socket) => { blocked.push('websocket_denied'); socket.close(); });
        await context.addInitScript(() => { window.open = () => null; });
        context.on('page', (page) => { if (sessionPage.main && page !== sessionPage.main) { blocked.push('popup_denied'); void page.close(); } });
        const page = await context.newPage();
        sessionPage.main = page;
        page.on('dialog', (dialog) => { void dialog.dismiss(); });
        page.setDefaultTimeout(2000);
        return {
          page, context,
          async inspect(path: string, timeoutMs = 2000): Promise<PageEvidence> {
            if (!paths.has(path) || path === '/fixture.js') throw new Error('Unknown fixture path');
            if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 5000) throw new Error('Invalid fixture timeout');
            const requestedUrl = origin + path;
            const started = performance.now();
            const reasons: string[] = [];
            const errorListener = () => { reasons.push('script_error'); };
            const blockedBefore = blocked.length;
            page.on('pageerror', errorListener);
            const source = javaScriptEnabled ? 'rendered_dom' : 'static_html_dom';
            let evidence: PageEvidence['evidence'] = [];
            try {
              const response = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
              if (!response?.ok()) reasons.push('http_error');
              if (javaScriptEnabled) {
                const remaining = Math.max(1, timeoutMs - (performance.now() - started));
                await page.locator('main[data-render-ready="true"]').waitFor({ state: 'visible', timeout: remaining });
              }
              const result = await extractVisibleEvidence(page, source);
              evidence = result.evidence;
              if (result.truncated) reasons.push('extraction_limit');
            } catch (error) {
              reasons.push(error instanceof errors.TimeoutError ? 'render_timeout' : 'navigation_or_extraction_error');
            } finally { page.off('pageerror', errorListener); }
            if (blocked.length !== blockedBefore) reasons.push('blocked_request');
            return {
              schemaVersion: 'rendered-fixture-0.1', requestedUrl, finalUrl: page.url(), viewport, source,
              status: reasons.length ? 'incomplete' : 'complete_fixture', reasons: [...new Set(reasons)], evidence,
              signals: {
                phoneDetected: evidence.some((item) => item.kind === 'phone') ? true : null,
                contactFormDetected: evidence.some((item) => item.kind === 'form') ? true : null,
                bookingElementDetected: evidence.some((item) => item.kind === 'booking') ? true : null,
                ctaDetected: evidence.some((item) => item.kind === 'cta') ? true : null,
              }, elapsedMs: Math.round(performance.now() - started),
            };
          },
          async close() { await context.close(); contexts.delete(context); },
        };
      } catch (error) { await context.close(); contexts.delete(context); throw error; }
    },
    async close() {
      if (closed) return;
      closed = true;
      try {
        try {
          await Promise.all([...contexts].map((context) => context.close()));
        } finally {
          contexts.clear();
          try { await browser.close(); }
          finally {
            try { await server.close(); }
            catch (error) { await server.kill(); throw error; }
          }
        }
      } finally { clearTimeout(deadline); }
    },
  };
}

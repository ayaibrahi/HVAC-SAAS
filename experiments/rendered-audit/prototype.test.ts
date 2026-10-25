import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { startFixtures } from './fixture-server.js';
import { isAllowedFixtureRequest, startRenderer } from './renderer.js';
import type { PageEvidence } from './extract.js';

test('fixture request policy rejects arbitrary destinations and writes', () => {
  const origin = 'http://127.0.0.1:12345';
  assert.equal(isAllowedFixtureRequest(origin + '/services', origin), true);
  for (const url of ['https://external.invalid/', 'file:///C:/Windows/', 'http://localhost:12345/', 'http://127.0.0.1:12346/', origin + '/unknown', origin + '/?url=external', 'http://name:password@127.0.0.1:12345/']) {
    assert.equal(isAllowedFixtureRequest(url, origin), false);
  }
  assert.equal(isAllowedFixtureRequest(origin + '/', origin, 'POST'), false);
});

test('real Chrome: static vs rendered desktop/mobile and failure cleanup', async (t) => {
  const started = performance.now();
  const fixtures = await startFixtures();
  const results: PageEvidence[] = [];
  let renderer: Awaited<ReturnType<typeof startRenderer>> | undefined;
  let profile: string | undefined;
  let version = '';
  let closed = false;
  try {
    renderer = await startRenderer(fixtures.origin);
    version = renderer.browser.version();
    const worker = renderer;
    const args = worker.server.process().spawnargs;
    profile = args.find((arg) => arg.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
    await t.test('sandbox enabled and fresh disposable profile', () => {
      assert.ok(!args.includes('--no-sandbox'));
      assert.ok(!args.includes('--disable-setuid-sandbox'));
      assert.ok(profile?.includes('playwright_chromiumdev_profile-'));
      assert.equal(worker.browser.contexts().length, 0);
    });
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await t.test(`${viewport.width}px: all three static pages miss JS-only elements`, async () => {
        const session = await worker.session(viewport, false);
        try {
          for (const path of ['/', '/services', '/contact']) {
            const html = fixtures.documents.get(path)!;
            assert.ok(!html.includes('id="dynamic-'));
            const result = await session.inspect(path);
            results.push(result);
            assert.equal(result.status, 'complete_fixture');
            assert.equal(result.source, 'static_html_dom');
            assert.equal(result.signals.ctaDetected, null);
            assert.equal(result.signals.phoneDetected, null);
            assert.equal(result.signals.contactFormDetected, null);
            assert.equal(result.signals.bookingElementDetected, null);
          }
        } finally { await session.close(); }
      });
      await t.test(`${viewport.width}px: sequential Home/Services/Contact rendering`, async () => {
        const session = await worker.session(viewport);
        try {
          assert.deepEqual(await session.context.cookies(), []);
          for (const path of ['/', '/services', '/contact']) {
            const result = await session.inspect(path);
            results.push(result);
            assert.equal(result.status, 'complete_fixture');
            assert.equal(result.finalUrl, fixtures.origin + path);
            assert.ok(result.evidence.every((item) => item.source === 'rendered_dom' && item.pageUrl === result.finalUrl && item.scope === 'analyzed_page'));
            assert.deepEqual([...new Set(result.evidence.filter((item) => item.kind === 'navigation').map((item) => new URL(item.href!).pathname))].sort(), ['/', '/contact', '/services']);
            assert.ok(!result.evidence.some((item) => item.label === 'Hidden phone'));
            if (path === '/') assert.ok(result.evidence.some((item) => item.kind === 'cta' && item.label === 'Request an estimate'));
            if (path === '/services') {
              assert.ok(result.evidence.some((item) => item.kind === 'phone' && item.href === 'tel:+12025550123'));
              assert.ok(result.evidence.some((item) => item.kind === 'contact' && item.label === 'Contact our team'));
            }
            if (path === '/contact') {
              assert.equal(result.signals.contactFormDetected, true);
              assert.ok(result.evidence.some((item) => item.kind === 'booking' && item.label === 'Book a visit'));
              assert.equal(result.evidence.some((item) => item.label === 'Call on mobile'), viewport.width === 390);
            }
          }
        } finally { await session.close(); }
      });
    }
    await t.test('missing readiness is incomplete/unknown within deadline', async () => {
      const session = await worker.session({ width: 1440, height: 900 });
      try {
        const result = await session.inspect('/timeout', 300);
        results.push(result);
        assert.equal(result.status, 'incomplete');
        assert.ok(result.reasons.includes('render_timeout'));
        assert.ok(result.elapsedMs < 1500);
        assert.equal(result.signals.phoneDetected, null);
        assert.equal(result.signals.bookingElementDetected, null);
      } finally { await session.close(); }
    });
    await t.test('script errors preserve incomplete coverage', async () => {
      const session = await worker.session({ width: 1440, height: 900 });
      try {
        const result = await session.inspect('/broken'); results.push(result);
        assert.equal(result.status, 'incomplete'); assert.ok(result.reasons.includes('script_error'));
      } finally { await session.close(); }
    });
    await t.test('external assets/fetch/frame/socket, popup, SW and POST are denied', async () => {
      const session = await worker.session({ width: 1440, height: 900 });
      try {
        const result = await session.inspect('/policy'); results.push(result);
        assert.equal(result.status, 'incomplete');
        assert.ok(result.reasons.includes('blocked_request'));
        assert.ok(worker.blocked.filter((item) => item === 'request_denied').length >= 6);
        assert.ok(worker.blocked.includes('websocket_denied'));
        assert.equal(worker.browser.contexts().length, 1);
        assert.equal(session.context.pages().length, 1);
        assert.equal(session.context.serviceWorkers().length, 0);
        assert.equal(fixtures.canaryRequests(), 0);
        assert.ok(fixtures.requests.every((request) => request.method === 'GET'));
        assert.ok(!fixtures.requests.some((request) => request.path === '/service-worker.js'));
      } finally { await session.close(); }
    });
    await t.test('off-origin navigation and redirects never reach canary', async () => {
      const session = await worker.session({ width: 1440, height: 900 });
      try {
        await assert.rejects(session.page.goto(fixtures.canaryOrigin + '/direct', { timeout: 1000 }));
        const result = await session.inspect('/redirect', 1000); results.push(result);
        assert.equal(result.status, 'incomplete');
        assert.ok(worker.blocked.includes('redirect_denied'));
        assert.equal(fixtures.canaryRequests(), 0);
      } finally { await session.close(); }
    });
    await t.test('unknown paths rejected before navigation', async () => {
      const session = await worker.session({ width: 390, height: 844 });
      try {
        await assert.rejects(session.inspect('https://external.invalid/'), /Unknown fixture path/);
        await assert.rejects(session.inspect('/', 999999), /Invalid fixture timeout/);
      } finally { await session.close(); }
    });
  } finally {
    if (renderer) {
      const child = renderer.server.process();
      const exited = child.exitCode === null ? once(child, 'exit') : Promise.resolve();
      await renderer.close(); await exited;
      closed = !renderer.browser.isConnected() && renderer.contexts.size === 0 && child.exitCode !== null;
    }
    await fixtures.close();
    await writeFile(new URL('./results.json', import.meta.url), JSON.stringify({
      browserVersion: version, elapsedMs: Math.round(performance.now() - started), browserClosed: closed,
      temporaryProfileRemoved: profile ? !existsSync(profile) : null,
      canaryRequests: fixtures.canaryRequests(), blockedRequests: renderer?.blocked, pages: results,
    }, null, 2));
  }
  await t.test('browser process, contexts, temporary profile and loopback servers cleaned up', async () => {
    assert.equal(closed, true); assert.ok(profile && !existsSync(profile));
    await assert.rejects(fetch(fixtures.origin)); await assert.rejects(fetch(fixtures.canaryOrigin));
  });
});

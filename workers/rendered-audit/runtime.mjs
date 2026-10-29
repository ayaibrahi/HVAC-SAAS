import { chromium } from 'playwright-core';
import { request } from 'node:http';
import { connect } from 'node:net';
import { readFileSync } from 'node:fs';
import { collectRenderedDocument } from './dom.mjs';

// This process has AF_UNIX only. No proxy, remote debugging listener, database,
// application env or direct fetch API is used. Every response is broker supplied.
const socketPath = '/run/scanvoro/broker.sock';
let browser, token, entry, busy = false, captures = 0, input = '';
let phase = 'configuration';
const pages = new Set(), viewports = new Set();
const output = value => {
  const line = JSON.stringify(value);
  if (Buffer.byteLength(line) > 132000) throw new Error('IPC limit');
  process.stdout.write(line + '\n');
};
const fatal = () => { process.exitCode = 1; process.stdout.write(JSON.stringify({ failure: phase }) + '\n'); process.stdin.destroy(); if (!browser) process.exit(1); void browser.close().then(() => process.exit(1), () => process.exit(1)); };
process.on('uncaughtException', fatal);
process.on('unhandledRejection', fatal);
process.on('SIGTERM', fatal);

async function assertNetworkDenied() {
  for (const host of ['93.184.216.34', '10.0.0.1', '169.254.169.254', '127.0.0.1', '::1']) {
    await new Promise((resolve, reject) => {
      const socket = connect({ host, port: 443 });
      socket.setTimeout(500, () => { socket.destroy(); reject(new Error('Network proof failed')); });
      socket.once('connect', () => { socket.destroy(); reject(new Error('Network proof failed')); });
      socket.once('error', error => error.code === 'EPERM' || error.code === 'EACCES' ? resolve() : reject(new Error('Network proof failed')));
    });
  }
  const status = readFileSync('/proc/self/status', 'utf8');
  if (!/^NoNewPrivs:\s+1$/m.test(status) || !/^Seccomp:\s+2$/m.test(status) || process.getuid() === 0) throw new Error('Containment failed');
}

function fetchViaBroker(url, method) {
  return new Promise((resolve, reject) => {
    const req = request({ socketPath, path: '/fetch', method: 'POST', headers: { authorization: token, 'content-type': 'application/json' }, timeout: 8000 }, res => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error('Broker denied')); return; }
      const chunks = []; let bytes = 0;
      res.on('data', chunk => { bytes += chunk.length; if (bytes > 675000) req.destroy(new Error('Broker limit')); else chunks.push(chunk); });
      res.on('error', () => reject(new Error('Broker failed')));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('Broker failed')); } });
    });
    req.on('timeout', () => req.destroy(new Error('Broker timeout')));
    req.on('error', () => reject(new Error('Broker failed')));
    req.end(JSON.stringify({ url, method }));
  });
}

async function initialize(config) {
  if (Object.keys(config).sort().join(',') !== 'entryUrl,token' || !/^[a-f0-9]{64}$/.test(config.token)) throw new Error('Bad configuration');
  entry = new URL(config.entryUrl); token = config.token;
  if (!['http:', 'https:'].includes(entry.protocol) || entry.username || entry.password || entry.port) throw new Error('Bad origin');
  phase = 'network_probe';
  await assertNetworkDenied();
  phase = 'browser_launch';
  browser = await chromium.launch({ chromiumSandbox: true, headless: true, timeout: 10000,
    env: { HOME: '/tmp', TMPDIR: '/tmp', PATH: '/usr/local/bin:/usr/bin:/bin' },
    args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run'] });
  // Real Chromium, deliberately without interception: direct TCP must fail.
  phase = 'browser_boundary';
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    for (const url of ['http://93.184.216.34/', 'http://127.0.0.1/', 'http://169.254.169.254/']) {
      let denied = false;
      try { await page.goto(url, { timeout: 700 }); } catch { denied = true; }
      if (!denied) throw new Error('Browser egress escaped');
    }
    const session = await context.newCDPSession(page);
    const { arguments: args } = await session.send('Browser.getBrowserCommandLine');
    if (args.includes('--no-sandbox') || !args.includes('--remote-debugging-pipe')) throw new Error('Sandbox disabled');
  } finally { await context.close(); }
  output({ ready: true, networkDenied: true, sandboxEnabled: true });
}

async function capture(command) {
  phase = 'capture';
  if (Object.keys(command).sort().join(',') !== 'id,url,viewport' || ++captures > 10 || !Number.isSafeInteger(command.id) || !['desktop','mobile'].includes(command.viewport) ||
      typeof command.url !== 'string' || command.url.length > 2048 || new URL(command.url).origin !== entry.origin) throw new Error('Capture denied');
  pages.add(command.url);
  const key = command.url + '|' + command.viewport;
  if (pages.size > 5 || viewports.has(key)) throw new Error('Capture limit');
  viewports.add(key);
  const started = performance.now(); const reasons = new Set();
  const context = await browser.newContext({ viewport: command.viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 360, height: 800 },
    serviceWorkers: 'block', acceptDownloads: false, ignoreHTTPSErrors: false });
  let main, result;
  try {
    await context.route('**/*', async route => {
      try {
        const req = route.request(), url = new URL(req.url());
        if (req.method() !== 'GET' || url.origin !== entry.origin || url.username || url.password || url.port ||
            req.frame() !== main?.mainFrame()) throw new Error('Denied');
        const response = await fetchViaBroker(req.url(), req.method());
        if (new URL(response.url).origin !== entry.origin) throw new Error('Denied');
        if (response.url !== req.url()) {
          // Preserve actual document URL/base after broker-validated redirects.
          await route.fulfill({ status: 302, headers: { location: response.url, 'cache-control': 'no-store' } });
        } else {
          await route.fulfill({ status: response.status, body: Buffer.from(response.body, 'base64'),
            headers: { 'content-type': response.contentType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
        }
      } catch { reasons.add('blocked_request'); await route.abort('blockedbyclient').catch(() => {}); }
    });
    await context.routeWebSocket('**/*', socket => { reasons.add('blocked_request'); socket.close(); });
    await context.addInitScript(() => { window.open = () => null; });
    context.on('page', page => { if (main && page !== main) { reasons.add('blocked_request'); void page.close(); } });
    main = await context.newPage();
    main.on('pageerror', () => reasons.add('script_error'));
    main.on('dialog', dialog => void dialog.dismiss());
    const response = await main.goto(command.url, { waitUntil: 'load', timeout: 6000 });
    if (!response?.ok()) reasons.add('http_error');
    // Bounded hydration window; no claim that all delayed application work ran.
    await main.waitForTimeout(250);
    phase = 'extraction';
    const document = await main.evaluate(collectRenderedDocument);
    if (document.truncated) reasons.add('limit');
    result = { id: command.id, result: JSON.stringify({ requestedUrl: command.url, finalUrl: main.url(), viewport: command.viewport,
      status: reasons.size ? 'incomplete' : 'observed', reasons: [...reasons], httpStatus: response?.status() ?? 500,
      elapsedMs: Math.min(8000, Math.round(performance.now() - started)), document }) };
  } finally { await context.close(); }
  output(result);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
  if (Buffer.byteLength(input) > 4096) return fatal();
  const newline = input.indexOf('\n');
  if (newline < 0) return;
  if (busy || input.indexOf('\n', newline + 1) >= 0) return fatal();
  let command;
  try { command = JSON.parse(input.slice(0, newline)); } catch { return fatal(); }
  input = input.slice(newline + 1); busy = true;
  void (browser ? capture(command) : initialize(command)).then(() => { busy = false; }, fatal);
});
process.stdin.on('end', fatal);

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// Synthetic content only. No URL supplied by an application user is accepted.
const script = `
const main = document.querySelector('main');
const path = location.pathname;
setTimeout(() => {
  if (path === '/') main.insertAdjacentHTML('beforeend', '<a id="dynamic-cta" href="/contact">Request an estimate</a>');
  if (path === '/services') main.insertAdjacentHTML('beforeend', '<a id="dynamic-phone" href="tel:+12025550123">Call our fixture team</a><a id="dynamic-contact" href="/contact">Contact our team</a>');
  if (path === '/contact') main.insertAdjacentHTML('beforeend', '<form id="dynamic-form"><label>Name<input name="name"></label><button type="submit">Send request</button></form><button id="dynamic-booking" type="button">Book a visit</button><a id="mobile-phone" class="mobile-only" href="tel:+12025550124">Call on mobile</a>');
  if (path !== '/timeout') main.dataset.renderReady = 'true';
}, 100);
if (path === '/broken') throw new Error('Synthetic fixture failure');
if (path === '/policy') {
  const probe = (url, init) => fetch(url, init).catch(() => {});
  probe('https://external.invalid/blocked-fetch');
  probe(document.body.dataset.canary + '/blocked-other-origin');
  probe('/contact', {method:'POST',body:'synthetic'});
  const image = new Image(); image.src = 'https://external.invalid/blocked.png';
  const asset = document.createElement('script'); asset.src = 'https://external.invalid/blocked.js'; document.head.append(asset);
  const frame = document.createElement('iframe'); frame.src = 'https://external.invalid/blocked-frame'; document.body.append(frame);
  window.open('https://external.invalid/blocked-popup');
  new WebSocket('wss://external.invalid/blocked-socket');
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}
`;

export async function startFixtures() {
  const requests: { path: string; method: string }[] = [];
  let canaryRequests = 0;
  const canary = createServer((_request, response) => {
    canaryRequests++;
    response.end('Unexpected request');
  });
  await new Promise<void>((resolve) => canary.listen(0, '127.0.0.1', resolve));
  const canaryOrigin = `http://127.0.0.1:${(canary.address() as AddressInfo).port}`;
  const pages = ['/', '/services', '/contact', '/timeout', '/broken', '/policy', '/redirect'];
  const documents = new Map(pages.map((path) => [path, `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trusted fixture ${path}</title><style>.hidden{display:none}.mobile-only{display:none}@media(max-width:600px){.mobile-only{display:block}}</style><script src="/fixture.js" defer></script></head><body data-canary="${canaryOrigin}"><nav><a href="/">Home</a><a href="/services">Services</a><a href="/contact">Contact</a></nav><main><h1>Trusted fixture ${path}</h1><a class="hidden" href="tel:+12025550999">Hidden phone</a></main></body></html>`]));
  const server = createServer((request, response) => {
    const path = request.url ?? '';
    requests.push({ path, method: request.method ?? '' });
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    if (path === '/redirect') {
      response.writeHead(302, { Location: `${canaryOrigin}/redirect-target` }).end(); return;
    }
    if (path === '/fixture.js') {
      response.setHeader('Content-Type', 'text/javascript'); response.end(script); return;
    }
    const html = documents.get(path);
    if (!html) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
  });
  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  } catch (error) {
    canary.close(); throw error;
  }
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    origin, canaryOrigin, documents, requests,
    canaryRequests: () => canaryRequests,
    async close() {
      await Promise.all([server, canary].map((item) => new Promise<void>((resolve, reject) => {
        item.close((error) => error ? reject(error) : resolve()); item.closeAllConnections();
      })));
    },
  };
}

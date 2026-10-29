import "server-only";
import { createServer } from "node:http";
import { chmod } from "node:fs/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { createPinnedEgressBroker } from "./pinned-egress";

// One job, one socket, one ephemeral capability. No TCP listener or CONNECT.
export async function openWorkerBroker(socketPath: string, egress: ReturnType<typeof createPinnedEgressBroker>) {
  const token = randomBytes(32).toString("hex");
  let active = 0, requests = 0;
  const pending = new Set<AbortController>();
  const server = createServer({ maxHeaderSize: 2048, requestTimeout: 9000, headersTimeout: 2000 }, async (req, res) => {
    const supplied = req.headers.authorization;
    if (req.method !== "POST" || req.url !== "/fetch" || typeof supplied !== "string" ||
        Buffer.byteLength(supplied) !== token.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token)) ||
        ++requests > 100 || active >= 4) {
      res.writeHead(403, { connection: "close" }).end(); req.resume(); return;
    }
    active++;
    const controller = new AbortController(); pending.add(controller);
    const timer = setTimeout(() => { controller.abort(); req.destroy(); res.destroy(); }, 8500);
    res.on("close", () => controller.abort());
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk.toString("utf8");
        if (Buffer.byteLength(body) > 4096) throw new Error("Request limit");
      }
      const input = JSON.parse(body);
      if (!input || Object.keys(input).sort().join(",") !== "method,url" || input.method !== "GET" ||
          typeof input.url !== "string" || input.url.length > 2048) throw new Error("Request rejected");
      const result = await egress.get(input.url, input.method, controller.signal);
      // Reject malformed trusted-adapter responses too; never forward headers.
      if (result.body.byteLength > 500_000) throw new Error("Response limit");
      res.writeHead(200, { "content-type": "application/json", connection: "close" });
      res.end(JSON.stringify({ url: result.url, status: result.status, contentType: result.contentType, body: Buffer.from(result.body).toString("base64") }));
    } catch { if (!res.headersSent) res.writeHead(403, { connection: "close" }); res.end(); }
    finally { clearTimeout(timer); pending.delete(controller); active--; }
  });
  server.maxConnections = 8;
  server.on("connect", (_req, socket) => socket.destroy());
  server.on("upgrade", (_req, socket) => socket.destroy());
  server.on("clientError", (_error, socket) => socket.destroy());
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(socketPath, resolve); });
  try { await chmod(socketPath, 0o600); }
  catch { server.closeAllConnections(); server.close(); throw new Error("Broker permissions unavailable"); }
  return { token, async close() {
    for (const controller of pending) controller.abort();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } };
}

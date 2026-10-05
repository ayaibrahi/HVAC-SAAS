import { InMemoryRateLimiter } from "@/lib/rate-limit";

export const publicShareRouteRateLimiter = new InMemoryRateLimiter({
  maxAttempts: 60,
  windowMs: 5 * 60 * 1000,
});

export function getPublicShareRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const connectingIp = request.headers.get("cf-connecting-ip");
  const candidate = forwardedFor?.split(",")[0]?.trim() || realIp || connectingIp;

  return `public-share:${candidate?.trim() || "unknown"}`;
}

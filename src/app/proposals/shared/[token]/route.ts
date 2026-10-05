import {
  publicShareSecurityHeaders,
  renderProposalUnavailableHtml,
  renderPublicProposalHtml,
} from "@/features/proposals/share-links/public-page";
import {
  getPublicShareRateLimitKey,
  publicShareRouteRateLimiter,
} from "@/features/proposals/share-links/rate-limit";
import { resolvePublicShareToken } from "@/features/proposals/share-links/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicProposalRouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(request: Request, context: PublicProposalRouteContext) {
  const rateLimit = publicShareRouteRateLimiter.check(
    getPublicShareRateLimitKey(request),
  );

  if (!rateLimit.allowed) {
    return createUnavailableResponse(429);
  }

  try {
    const { token } = await context.params;
    const publicView = await resolvePublicShareToken(token);

    if (!publicView) {
      return createUnavailableResponse(404);
    }

    return new Response(renderPublicProposalHtml(publicView), {
      status: 200,
      headers: {
        ...publicShareSecurityHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch {
    return createUnavailableResponse(404);
  }
}

function createUnavailableResponse(status: 404 | 429) {
  return new Response(renderProposalUnavailableHtml(), {
    status,
    headers: {
      ...publicShareSecurityHeaders,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { buildFeedbackUrl } from "@/lib/action-feedback";
import { resolveSafeAuthRedirectPath } from "@/lib/auth/redirects";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = resolveSafeAuthRedirectPath(requestUrl.searchParams.get("next"));

  if (!getSupabasePublicConfig()) {
    return NextResponse.redirect(
      new URL(
        buildFeedbackUrl("/sign-in", {
          error: "Supabase is not configured. Add the required environment variables.",
        }),
        requestUrl.origin,
      ),
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
    }
  }

  return NextResponse.redirect(
    new URL(
      buildFeedbackUrl("/sign-in", {
        error: "We could not confirm that sign-in link.",
      }),
      requestUrl.origin,
    ),
  );
}

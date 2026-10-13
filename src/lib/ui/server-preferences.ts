import "server-only";
import { cookies } from "next/headers";
import { normalizePreferences, preferenceCookies } from "@/lib/ui/preferences";

export async function getUiPreferences() {
  const jar = await cookies();
  return normalizePreferences(
    jar.get(preferenceCookies.theme)?.value,
    jar.get(preferenceCookies.locale)?.value,
  );
}

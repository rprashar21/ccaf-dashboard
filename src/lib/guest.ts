import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * Stand-in for real auth while sign-in is disabled (OAuth apps are not
 * configured yet — see AUTH_GITHUB_ID/AUTH_GOOGLE_ID in .env). The proxy
 * (src/proxy.ts) sets a long-lived, unguessable cookie on first visit; this
 * just ensures a matching User row exists and returns its id, so the rest of
 * the app (attempts, responses, dashboard, profile) works exactly as it will
 * once real sign-in is switched back on. To re-enable real auth, swap call
 * sites back to requireUserId() in src/lib/session.ts — that code is
 * untouched — and restore the auth gate in src/proxy.ts.
 */
export const GUEST_COOKIE = "guest_uid";

export async function getGuestUserId(): Promise<string> {
  const store = await cookies();
  const id = store.get(GUEST_COOKIE)?.value;
  if (!id) {
    throw new Error(
      "Guest cookie missing. The proxy should set it on every page request — reload the page.",
    );
  }

  // Lazy-create: the cookie may outlive a `pnpm db:reset` during development.
  await db.user.upsert({
    where: { id },
    create: { id, name: "Guest" },
    update: {},
  });

  return id;
}

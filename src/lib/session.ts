import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Shared guard for pages and server actions. Redirects to sign-in when there
 * is no session rather than throwing, since callers are always inside a
 * request (a page render or a server action), not a pure function.
 */
export async function requireUserId(callbackUrl?: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(callbackUrl ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signin");
  }
  return session.user.id;
}

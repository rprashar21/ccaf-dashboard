import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GUEST_COOKIE } from "@/lib/guest";

// --- Real auth, disabled for now -------------------------------------------
// OAuth apps are not configured yet (AUTH_GITHUB_ID / AUTH_GOOGLE_ID are
// empty in .env), so sign-in is temporarily bypassed via a guest cookie
// below. Nothing here is deleted: to switch back to real auth, restore this
// block as `export const proxy` and drop the guest logic underneath.
//
// import NextAuth from "next-auth";
// import { authConfig } from "@/lib/auth.config";
// const { auth } = NextAuth(authConfig);
// export const proxy = auth;

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Ensures every visitor has a stable guest id before any page/action runs,
 * since Next only allows setting cookies from a proxy/route handler, not
 * from a Server Component render. src/lib/guest.ts reads this cookie.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(GUEST_COOKIE)) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set(GUEST_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
  return response;
}

export const config = {
  // Everything except static assets, API routes, and well-known files — the
  // guest cookie needs to exist before any page or server action runs.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|robots.txt|sitemap.xml).*)"],
};

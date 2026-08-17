import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Next 16 renamed `middleware.ts` to `proxy.ts`; the export must be named
// `proxy` (or default). This builds its own edge-safe NextAuth instance from
// the Prisma-free config — importing from `@/lib/auth` would drag the adapter
// into the edge runtime.
const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  // Only the routes that genuinely need a session. Certification overviews and
  // domain pages stay public so they remain crawlable, and `/` is deliberately
  // absent: doing the signed-in redirect here would cost a JWT decode on every
  // anonymous landing hit and defeat caching of the marketing page.
  matcher: ["/dashboard/:path*", "/c/:certSlug/practice/:path*"],
};

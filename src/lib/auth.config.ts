import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

// Edge-safe. Deliberately imports no Prisma: this config is what the proxy
// (middleware) loads, and Prisma cannot run on the edge runtime.

export const authConfig = {
  providers: [
    GitHub({
      clientId: process.env["AUTH_GITHUB_ID"],
      clientSecret: process.env["AUTH_GITHUB_SECRET"],
      // Two accounts with the same email must not be silently merged.
      allowDangerousEmailAccountLinking: false,
    }),
    Google({
      clientId: process.env["AUTH_GOOGLE_ID"],
      clientSecret: process.env["AUTH_GOOGLE_SECRET"],
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;

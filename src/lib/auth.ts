import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { db } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";

// JWT sessions, not database sessions. The proxy runs on the edge and cannot
// query Prisma, so a database strategy would force either a Node-runtime proxy
// or a database round trip on every navigation. The adapter still persists
// User and Account rows, so user ids stay stable and foreign-keyable.

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db) as Adapter,
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = "role" in user ? (user.role as string) : "LEARNER";
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = (token.role as string | undefined) ?? "LEARNER";
      return session;
    },
  },
});

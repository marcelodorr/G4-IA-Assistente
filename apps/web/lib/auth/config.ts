import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const publica = ["/login", "/setup"].some((p) => pathname.startsWith(p))
        || pathname.startsWith("/invite/")
        || pathname.startsWith("/api/setup")
        || pathname.startsWith("/api/invites/accept")
        || pathname.startsWith("/api/auth")
        || pathname.startsWith("/api/health")
        || pathname.startsWith("/brand/");
      if (publica) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 1;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "admin" | "member";
      session.user.sessionVersion = token.sessionVersion as number;
      return session;
    },
  },
} satisfies NextAuthConfig;

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

// Next.js 16 renomeou a convenção `middleware.ts` para `proxy.ts` (export
// nomeado `proxy` em vez de default export `middleware`). A brief original
// (Auth.js v4/v5 docs) usa `export default NextAuth(authConfig).auth;` em
// `middleware.ts` — aqui o mesmo `.auth` é exportado como `proxy`.
export const proxy = NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};

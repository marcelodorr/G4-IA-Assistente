import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./config";
import { verifyCredentials } from "./verify-credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const user = await verifyCredentials(creds.email as string, creds.password as string);
        if (user) await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
        return user;
      },
    }),
  ],
});

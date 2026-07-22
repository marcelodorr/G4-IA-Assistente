import { eq } from "drizzle-orm";
import { verifyPassword } from "./password";
import type { users } from "@/lib/db/schema";

type UserRow = Pick<typeof users.$inferSelect, "id" | "name" | "email" | "role" | "active" | "passwordHash" | "sessionVersion">;
type FindUser = (email: string) => Promise<UserRow | null>;

async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { db } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");
  return (await db.select({
    id: users.id, name: users.name, email: users.email, role: users.role,
    active: users.active, passwordHash: users.passwordHash, sessionVersion: users.sessionVersion,
  }).from(users).where(eq(users.email, email)))[0] ?? null;
}

export async function verifyCredentials(email: string, password: string, findUser: FindUser = findUserByEmail) {
  const user = await findUser(email.trim().toLowerCase());
  if (!user || !user.active) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, sessionVersion: user.sessionVersion };
}

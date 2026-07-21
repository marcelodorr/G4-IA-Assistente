import { and, eq, ne } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

export async function listUsers(db: Db) {
  return db.select({
    id: users.id, name: users.name, email: users.email,
    role: users.role, active: users.active, createdAt: users.createdAt,
  }).from(users).orderBy(users.createdAt);
}

export async function setUserActive(db: Db, id: string, active: boolean) {
  if (!active) {
    const outrosAdmins = await db.select().from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, id)));
    const [alvo] = await db.select().from(users).where(eq(users.id, id));
    if (alvo?.role === "admin" && outrosAdmins.length === 0) {
      throw new Error("Não é possível desativar o último admin ativo");
    }
  }
  await db.update(users).set({ active }).where(eq(users.id, id));
}

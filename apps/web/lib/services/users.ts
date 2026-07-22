import { and, eq, ne } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

export async function listUsers(db: Db) {
  return db.select({
    id: users.id, name: users.name, email: users.email,
    role: users.role, active: users.active, dailyTokenLimit: users.dailyTokenLimit,
    monthlyTokenLimit: users.monthlyTokenLimit, createdAt: users.createdAt,
  }).from(users).orderBy(users.createdAt);
}

export async function setUserQuotas(db: Db, id: string, input: { dailyTokenLimit: number | null; monthlyTokenLimit: number | null }) {
  const valid = (value: number | null) => value === null || (Number.isInteger(value) && value >= 1_000);
  if (!valid(input.dailyTokenLimit) || !valid(input.monthlyTokenLimit)) throw new Error("Cota inválida");
  if (input.dailyTokenLimit && input.monthlyTokenLimit && input.monthlyTokenLimit < input.dailyTokenLimit) {
    throw new Error("A cota mensal deve ser maior ou igual à diária");
  }
  await db.update(users).set(input).where(eq(users.id, id));
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

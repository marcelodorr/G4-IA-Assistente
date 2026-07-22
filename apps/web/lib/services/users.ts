import { and, eq, ne, sql } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import type { Db, Tx } from "@/lib/db";

export async function listUsers(db: Db) {
  return db.select({
    id: users.id, name: users.name, email: users.email,
    role: users.role, active: users.active, dailyTokenLimit: users.dailyTokenLimit,
    monthlyTokenLimit: users.monthlyTokenLimit, lastLoginAt: users.lastLoginAt,
    createdAt: users.createdAt,
  }).from(users).orderBy(users.createdAt);
}

async function ensureAnotherActiveAdmin(tx: Tx, id: string) {
  const [other] = await tx.select({ id: users.id }).from(users).where(and(
    eq(users.role, "admin"), eq(users.active, true), ne(users.id, id),
  )).limit(1);
  if (!other) throw new Error("Não é possível remover ou desativar o último administrador ativo");
}

export async function setUserActive(db: Db, id: string, active: boolean) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(917402::bigint)`);
    const [target] = await tx.select().from(users).where(eq(users.id, id));
    if (!target) throw new Error("Usuário não encontrado");
    if (!active && target.active && target.role === "admin") await ensureAnotherActiveAdmin(tx, id);
    await tx.update(users).set({ active, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, id));
  });
}

export async function setUserRole(db: Db, id: string, role: "admin" | "member") {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(917402::bigint)`);
    const [target] = await tx.select().from(users).where(eq(users.id, id));
    if (!target) throw new Error("Usuário não encontrado");
    if (target.role === "admin" && role === "member" && target.active) await ensureAnotherActiveAdmin(tx, id);
    await tx.update(users).set({ role, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, id));
  });
}

export async function revokeUserSessions(db: Db, id: string) {
  const rows = await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, id)).returning({ id: users.id });
  if (rows.length === 0) throw new Error("Usuário não encontrado");
}

export async function setUserQuotas(db: Db, id: string, input: { dailyTokenLimit: number | null; monthlyTokenLimit: number | null }) {
  const valid = (value: number | null) => value === null || (Number.isInteger(value) && value >= 1_000);
  if (!valid(input.dailyTokenLimit) || !valid(input.monthlyTokenLimit)) throw new Error("Cota inválida");
  if (input.dailyTokenLimit && input.monthlyTokenLimit && input.monthlyTokenLimit < input.dailyTokenLimit) {
    throw new Error("A cota mensal deve ser maior ou igual à diária");
  }
  await db.update(users).set(input).where(eq(users.id, id));
}

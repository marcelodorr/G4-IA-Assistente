import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { assistants, userAssistantAccess, users } from "@/lib/db/schema";
import { isAllowedModel } from "@/lib/ai/models";
import type { Db, Tx } from "@/lib/db";

export async function listUsers(db: Db) {
  const rows = await db.select({
    id: users.id, name: users.name, email: users.email,
    role: users.role, active: users.active, dailyTokenLimit: users.dailyTokenLimit,
    weeklyTokenLimit: users.weeklyTokenLimit, monthlyTokenLimit: users.monthlyTokenLimit,
    allowedModels: users.allowedModels, assistantAccessMode: users.assistantAccessMode,
    lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
  }).from(users).orderBy(users.createdAt);
  const access = await db.select().from(userAssistantAccess);
  const byUser = new Map<string, string[]>();
  for (const item of access) byUser.set(item.userId, [...(byUser.get(item.userId) ?? []), item.assistantId]);
  return rows.map((row) => ({
    ...row,
    allowedModels: normalizeAllowedModels(row.allowedModels),
    assistantIds: byUser.get(row.id) ?? [],
  }));
}

export function normalizeAllowedModels(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((item): item is string => typeof item === "string" && isAllowedModel(item)))];
}

export async function getUserAccess(db: Db | Tx, id: string) {
  const [user] = await db.select({
    allowedModels: users.allowedModels,
    assistantAccessMode: users.assistantAccessMode,
  }).from(users).where(eq(users.id, id));
  if (!user) throw new Error("Usuário não encontrado");
  const access = user.assistantAccessMode === "selected"
    ? await db.select({ assistantId: userAssistantAccess.assistantId }).from(userAssistantAccess).where(eq(userAssistantAccess.userId, id))
    : [];
  return {
    allowedModels: normalizeAllowedModels(user.allowedModels),
    assistantAccessMode: user.assistantAccessMode,
    assistantIds: access.map((item) => item.assistantId),
  };
}

export function filterUserModels(globallyEnabled: string[], allowedModels: string[] | null) {
  return allowedModels === null ? globallyEnabled : globallyEnabled.filter((model) => allowedModels.includes(model));
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

export async function setUserQuotas(db: Db, id: string, input: { dailyTokenLimit: number | null; weeklyTokenLimit: number | null; monthlyTokenLimit: number | null }) {
  const valid = (value: number | null) => value === null || (Number.isInteger(value) && value >= 1_000);
  if (!valid(input.dailyTokenLimit) || !valid(input.weeklyTokenLimit) || !valid(input.monthlyTokenLimit)) throw new Error("Cota inválida");
  if (input.dailyTokenLimit && input.weeklyTokenLimit && input.weeklyTokenLimit < input.dailyTokenLimit) {
    throw new Error("A cota semanal deve ser maior ou igual à diária");
  }
  if (input.dailyTokenLimit && input.monthlyTokenLimit && input.monthlyTokenLimit < input.dailyTokenLimit) {
    throw new Error("A cota mensal deve ser maior ou igual à diária");
  }
  if (input.weeklyTokenLimit && input.monthlyTokenLimit && input.monthlyTokenLimit < input.weeklyTokenLimit) {
    throw new Error("A cota mensal deve ser maior ou igual à semanal");
  }
  await db.update(users).set(input).where(eq(users.id, id));
}

export async function setUserPermissions(db: Db, id: string, input: {
  allowedModels: string[] | null;
  assistantAccessMode: "all" | "selected";
  assistantIds: string[];
}) {
  const allowedModels = input.allowedModels === null ? null : [...new Set(input.allowedModels)];
  if (allowedModels?.some((model) => !isAllowedModel(model))) throw new Error("Modelo inválido");
  const assistantIds = [...new Set(input.assistantIds)];
  if (input.assistantAccessMode === "selected" && assistantIds.length > 0) {
    const found = await db.select({ id: assistants.id }).from(assistants).where(inArray(assistants.id, assistantIds));
    if (found.length !== assistantIds.length) throw new Error("Um ou mais assistentes são inválidos");
  }
  await db.transaction(async (tx) => {
    const updated = await tx.update(users).set({
      allowedModels,
      assistantAccessMode: input.assistantAccessMode,
    }).where(eq(users.id, id)).returning({ id: users.id });
    if (updated.length === 0) throw new Error("Usuário não encontrado");
    await tx.delete(userAssistantAccess).where(eq(userAssistantAccess.userId, id));
    if (input.assistantAccessMode === "selected" && assistantIds.length > 0) {
      await tx.insert(userAssistantAccess).values(assistantIds.map((assistantId) => ({ userId: id, assistantId })));
    }
  });
}

import { randomBytes } from "crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { invites, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import type { Db, Tx } from "@/lib/db";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvite(db: Db | Tx, input: { email: string; role: "admin" | "member"; createdBy?: string | null }) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(invites).values({
    token,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    createdBy: input.createdBy ?? null,
    expiresAt: new Date(Date.now() + SETE_DIAS_MS),
  });
  return { token };
}

export async function getValidInvite(db: Db | Tx, token: string) {
  const rows = await db.select().from(invites)
    .where(and(eq(invites.token, token), isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, new Date())));
  return rows[0] ?? null;
}

export async function listInvites(db: Db) {
  return db.select().from(invites).orderBy(desc(invites.createdAt));
}

export async function revokeInvite(db: Db, id: string) {
  const rows = await db.update(invites).set({ revokedAt: new Date() })
    .where(and(eq(invites.id, id), isNull(invites.usedAt), isNull(invites.revokedAt)))
    .returning({ id: invites.id });
  if (rows.length === 0) throw new Error("Convite não encontrado ou já encerrado");
}

export async function renewInvite(db: Db, id: string, createdBy: string) {
  return db.transaction(async (tx) => {
    const [invite] = await tx.select().from(invites).where(eq(invites.id, id));
    if (!invite || invite.usedAt) throw new Error("Convite não encontrado ou já utilizado");
    if (!invite.revokedAt) await tx.update(invites).set({ revokedAt: new Date() }).where(eq(invites.id, id));
    return createInvite(tx, { email: invite.email, role: invite.role, createdBy });
  });
}

export async function acceptInvite(db: Db, token: string, input: { name: string; password: string }) {
  if (input.password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres");
  if (!input.name.trim()) throw new Error("Nome é obrigatório");
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${token})::bigint)`);
    const invite = await getValidInvite(tx, token);
    if (!invite) throw new Error("Convite inválido ou expirado");
    const existing = await tx.select({ id: users.id }).from(users).where(eq(users.email, invite.email));
    if (existing.length > 0) throw new Error("Este e-mail já possui conta");
    await tx.insert(users).values({
      name: input.name.trim(), email: invite.email,
      passwordHash, role: invite.role,
    });
    await tx.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, invite.id));
  });
}

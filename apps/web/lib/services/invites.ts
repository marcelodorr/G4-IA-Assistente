import { randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { invites, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import type { Db } from "@/lib/db";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvite(db: Db, input: { email: string; role: "admin" | "member" }) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(invites).values({
    token,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    expiresAt: new Date(Date.now() + SETE_DIAS_MS),
  });
  return { token };
}

export async function getValidInvite(db: Db, token: string) {
  const rows = await db.select().from(invites)
    .where(and(eq(invites.token, token), isNull(invites.usedAt), gt(invites.expiresAt, new Date())));
  return rows[0] ?? null;
}

export async function acceptInvite(db: Db, token: string, input: { name: string; password: string }) {
  const invite = await getValidInvite(db, token);
  if (!invite) throw new Error("Convite inválido ou expirado");
  if (input.password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres");
  const existing = await db.select().from(users).where(eq(users.email, invite.email));
  if (existing.length > 0) throw new Error("Este e-mail já possui conta");
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      name: input.name.trim(), email: invite.email,
      passwordHash: await hashPassword(input.password), role: invite.role,
    });
    await tx.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, invite.id));
  });
}

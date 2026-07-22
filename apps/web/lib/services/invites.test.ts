import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { acceptInvite, createInvite, getValidInvite, renewInvite, revokeInvite } from "./invites";
import { revokeUserSessions, setUserActive, setUserRole } from "./users";
import { users, invites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";

describe.skipIf(!process.env.TEST_DATABASE_URL)("invites", () => {
  beforeEach(truncateAll);

  it("cria convite válido por 7 dias e aceita uma única vez", async () => {
    const db = await getTestDb();
    const { token } = await createInvite(db, { email: "novo@sequor.com.br", role: "member" });
    expect(token.length).toBeGreaterThan(30);
    expect(await getValidInvite(db, token)).not.toBeNull();

    await acceptInvite(db, token, { name: "Novo", password: "senha123!" });
    const [u] = await db.select().from(users).where(eq(users.email, "novo@sequor.com.br"));
    expect(u.role).toBe("member");
    expect(await getValidInvite(db, token)).toBeNull(); // já usado
    await expect(acceptInvite(db, token, { name: "X", password: "senha123!" })).rejects.toThrow(/inválido/i);
  });

  it("aceita somente uma requisição concorrente para o mesmo convite", async () => {
    const db = await getTestDb();
    const { token } = await createInvite(db, { email: "concorrente@sequor.com.br", role: "member" });
    const results = await Promise.allSettled([
      acceptInvite(db, token, { name: "Primeiro", password: "senha123!" }),
      acceptInvite(db, token, { name: "Segundo", password: "senha123!" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const created = await db.select().from(users).where(eq(users.email, "concorrente@sequor.com.br"));
    expect(created).toHaveLength(1);
  });

  it("rejeita convite expirado", async () => {
    const db = await getTestDb();
    const { token } = await createInvite(db, { email: "a@b.com", role: "member" });
    await db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invites.token, token));
    expect(await getValidInvite(db, token)).toBeNull();
  });

  it("revoga e renova convites", async () => {
    const db = await getTestDb();
    const [admin] = await db.insert(users).values({ name: "Adm", email: "convites@sequor.com.br", passwordHash: "x", role: "admin" }).returning();
    const { token } = await createInvite(db, { email: "a@b.com", role: "member", createdBy: admin.id });
    const [invite] = await db.select().from(invites).where(eq(invites.token, token));
    await revokeInvite(db, invite.id);
    expect(await getValidInvite(db, token)).toBeNull();
    const renewed = await renewInvite(db, invite.id, admin.id);
    expect(renewed.token).not.toBe(token);
    expect(await getValidInvite(db, renewed.token)).not.toBeNull();
  });

  it("não desativa o último admin ativo", async () => {
    const db = await getTestDb();
    const [admin] = await db.insert(users).values({
      name: "Adm", email: "adm@sequor.com.br", passwordHash: await hashPassword("x".repeat(8)), role: "admin",
    }).returning();
    await expect(setUserActive(db, admin.id, false)).rejects.toThrow(/último admin/i);
  });

  it("protege o último admin ao alterar papel e revoga sessões", async () => {
    const db = await getTestDb();
    const [admin] = await db.insert(users).values({ name: "Adm", email: "papel@sequor.com.br", passwordHash: "x", role: "admin" }).returning();
    await expect(setUserRole(db, admin.id, "member")).rejects.toThrow(/último administrador/i);
    const [other] = await db.insert(users).values({ name: "Outro", email: "outro-admin@sequor.com.br", passwordHash: "x", role: "admin" }).returning();
    await setUserRole(db, admin.id, "member");
    await revokeUserSessions(db, other.id);
    const [updated] = await db.select().from(users).where(eq(users.id, other.id));
    expect(updated.sessionVersion).toBe(2);
  });
});

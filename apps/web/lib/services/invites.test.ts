import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { createInvite, getValidInvite, acceptInvite } from "./invites";
import { setUserActive } from "./users";
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

  it("rejeita convite expirado", async () => {
    const db = await getTestDb();
    const { token } = await createInvite(db, { email: "a@b.com", role: "member" });
    await db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invites.token, token));
    expect(await getValidInvite(db, token)).toBeNull();
  });

  it("não desativa o último admin ativo", async () => {
    const db = await getTestDb();
    const [admin] = await db.insert(users).values({
      name: "Adm", email: "adm@sequor.com.br", passwordHash: await hashPassword("x".repeat(8)), role: "admin",
    }).returning();
    await expect(setUserActive(db, admin.id, false)).rejects.toThrow(/último admin/i);
  });
});

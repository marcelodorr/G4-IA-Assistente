import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { integrationConnections, users } from "@/lib/db/schema";
import { canUserUseIntegration, consumeOauthState, createOauthState, getIntegrationConfig, listUserIntegrations, saveUserConnection, updateIntegrationConfig } from "./integrations";

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;

suite("integrations service", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = "e".repeat(64);
    await truncateAll();
  });

  async function seedUser() {
    const db = await getTestDb();
    return (await db.insert(users).values({ name: "Usuário", email: "user@sequor.com.br", passwordHash: "hash" }).returning())[0];
  }

  it("libera integração ativa apenas para usuários selecionados", async () => {
    const db = await getTestDb();
    const user = await seedUser();
    await updateIntegrationConfig(db, "apify", { active: true, userIds: [user.id], updatedBy: user.id });
    expect(await canUserUseIntegration(db, user.id, "apify")).toBe(true);
    expect((await listUserIntegrations(db, user.id)).map((item) => item.id)).toEqual(["apify"]);
  });

  it("criptografa segredo administrativo e token individual", async () => {
    const db = await getTestDb();
    const user = await seedUser();
    await updateIntegrationConfig(db, "google_calendar", { active: true, clientId: "client-id", clientSecret: "client-secret", userIds: [user.id], updatedBy: user.id });
    expect((await getIntegrationConfig(db, "google_calendar")).clientSecret).toBe("client-secret");
    await saveUserConnection(db, { userId: user.id, provider: "google_calendar", accessToken: "access-token", refreshToken: "refresh-token", accountLabel: "user@sequor.com.br" });
    const [raw] = await db.select().from(integrationConnections).where(eq(integrationConnections.userId, user.id));
    expect(raw.accessTokenEncrypted).not.toContain("access-token");
    expect((await listUserIntegrations(db, user.id))[0]).toMatchObject({ connected: true, accountLabel: "user@sequor.com.br" });
  });

  it("consome state OAuth uma única vez", async () => {
    const db = await getTestDb();
    const user = await seedUser();
    const state = await createOauthState(db, user.id, "jira", "https://app.example/callback");
    await expect(consumeOauthState(db, state)).resolves.toMatchObject({ userId: user.id, provider: "jira" });
    await expect(consumeOauthState(db, state)).rejects.toThrow(/expirada|inválida/i);
  });
});

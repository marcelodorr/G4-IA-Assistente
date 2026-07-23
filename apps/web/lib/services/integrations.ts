import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { decrypt, encrypt } from "@/lib/crypto";
import { integrationConfigs, integrationConnections, integrationOauthStates, userIntegrationAccess, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { INTEGRATIONS, INTEGRATION_PROVIDERS, type IntegrationProvider } from "@/lib/integrations/catalog";

const hashState = (state: string) => createHash("sha256").update(state).digest("hex");

export async function listIntegrationAdmin(db: Db) {
  const [configs, access] = await Promise.all([
    db.select().from(integrationConfigs),
    db.select().from(userIntegrationAccess),
  ]);
  return INTEGRATION_PROVIDERS.map((provider) => {
    const config = configs.find((item) => item.provider === provider);
    return {
      ...INTEGRATIONS[provider],
      active: config?.active ?? false,
      clientId: config?.clientId ?? "",
      secretConfigured: Boolean(config?.clientSecretEncrypted),
      userIds: access.filter((item) => item.provider === provider).map((item) => item.userId),
    };
  });
}

export async function updateIntegrationConfig(db: Db, provider: IntegrationProvider, input: {
  active: boolean;
  clientId?: string;
  clientSecret?: string;
  clearSecret?: boolean;
  userIds: string[];
  updatedBy: string;
}) {
  const definition = INTEGRATIONS[provider];
  const clientId = definition.authType === "oauth" ? input.clientId?.trim() || null : null;
  const existing = (await db.select().from(integrationConfigs).where(eq(integrationConfigs.provider, provider)))[0];
  const clientSecretEncrypted = input.clearSecret ? null
    : input.clientSecret?.trim() ? encrypt(input.clientSecret.trim())
      : existing?.clientSecretEncrypted ?? null;
  if (input.active && definition.authType === "oauth" && (!clientId || !clientSecretEncrypted)) {
    throw new Error("Informe Client ID e Client Secret antes de ativar a integração");
  }
  const userIds = [...new Set(input.userIds)];
  if (userIds.length > 0) {
    const valid = await db.select({ id: users.id }).from(users).where(inArray(users.id, userIds));
    if (valid.length !== userIds.length) throw new Error("Um ou mais usuários são inválidos");
  }
  await db.transaction(async (tx) => {
    await tx.insert(integrationConfigs).values({ provider, active: input.active, clientId, clientSecretEncrypted, updatedBy: input.updatedBy, updatedAt: new Date() })
      .onConflictDoUpdate({ target: integrationConfigs.provider, set: { active: input.active, clientId, clientSecretEncrypted, updatedBy: input.updatedBy, updatedAt: new Date() } });
    await tx.delete(userIntegrationAccess).where(eq(userIntegrationAccess.provider, provider));
    if (userIds.length) await tx.insert(userIntegrationAccess).values(userIds.map((userId) => ({ userId, provider })));
    await tx.delete(integrationConnections).where(userIds.length
      ? and(eq(integrationConnections.provider, provider), notInArray(integrationConnections.userId, userIds))
      : eq(integrationConnections.provider, provider));
  });
}

export async function getIntegrationConfig(db: Db, provider: IntegrationProvider) {
  const config = (await db.select().from(integrationConfigs).where(eq(integrationConfigs.provider, provider)))[0];
  if (!config?.active) throw new Error("Integração não está ativa");
  return {
    ...config,
    clientSecret: config.clientSecretEncrypted ? decrypt(config.clientSecretEncrypted) : null,
  };
}

export async function canUserUseIntegration(db: Db, userId: string, provider: IntegrationProvider) {
  const [row] = await db.select({ provider: userIntegrationAccess.provider }).from(userIntegrationAccess)
    .innerJoin(integrationConfigs, eq(integrationConfigs.provider, userIntegrationAccess.provider))
    .where(and(eq(userIntegrationAccess.userId, userId), eq(userIntegrationAccess.provider, provider), eq(integrationConfigs.active, true))).limit(1);
  return Boolean(row);
}

export async function listUserIntegrations(db: Db, userId: string) {
  const [access, connections, configs] = await Promise.all([
    db.select().from(userIntegrationAccess).where(eq(userIntegrationAccess.userId, userId)),
    db.select().from(integrationConnections).where(eq(integrationConnections.userId, userId)),
    db.select().from(integrationConfigs).where(eq(integrationConfigs.active, true)),
  ]);
  const active = new Set(configs.map((item) => item.provider));
  return access.filter((item) => active.has(item.provider)).map((item) => {
    const connection = connections.find((current) => current.provider === item.provider);
    return {
      ...INTEGRATIONS[item.provider],
      connected: connection?.status === "connected",
      status: connection?.status ?? "not_connected",
      accountLabel: connection?.accountLabel ?? null,
      lastUsedAt: connection?.lastUsedAt ?? null,
      lastError: connection?.lastError ?? null,
    };
  });
}

export async function getUserConnection(db: Db, userId: string, provider: IntegrationProvider) {
  return (await db.select().from(integrationConnections).where(and(
    eq(integrationConnections.userId, userId),
    eq(integrationConnections.provider, provider),
  )))[0] ?? null;
}

export async function saveUserConnection(db: Db, input: {
  userId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  scopes?: string | null;
  externalAccountId?: string | null;
  accountLabel?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const existing = await getUserConnection(db, input.userId, input.provider);
  const values = {
    status: "connected" as const,
    accessTokenEncrypted: encrypt(input.accessToken),
    refreshTokenEncrypted: input.refreshToken ? encrypt(input.refreshToken) : existing?.refreshTokenEncrypted ?? null,
    expiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1_000) : null,
    scopes: input.scopes ?? null,
    externalAccountId: input.externalAccountId ?? null,
    accountLabel: input.accountLabel ?? null,
    metadata: input.metadata ?? {},
    lastError: null,
    updatedAt: new Date(),
  };
  await db.insert(integrationConnections).values({ userId: input.userId, provider: input.provider, ...values })
    .onConflictDoUpdate({ target: [integrationConnections.userId, integrationConnections.provider], set: values });
}

export async function disconnectIntegration(db: Db, userId: string, provider: IntegrationProvider) {
  await db.delete(integrationConnections).where(and(eq(integrationConnections.userId, userId), eq(integrationConnections.provider, provider)));
}

export async function createOauthState(db: Db, userId: string, provider: Exclude<IntegrationProvider, "apify">, redirectUri: string) {
  const state = randomBytes(32).toString("base64url");
  await db.insert(integrationOauthStates).values({ tokenHash: hashState(state), userId, provider, redirectUri, expiresAt: new Date(Date.now() + 10 * 60_000) });
  return state;
}

export async function consumeOauthState(db: Db, state: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(integrationOauthStates).where(eq(integrationOauthStates.tokenHash, hashState(state))).limit(1);
    if (!row || row.expiresAt.getTime() < Date.now()) throw new Error("Autorização expirada ou inválida. Inicie novamente.");
    await tx.delete(integrationOauthStates).where(eq(integrationOauthStates.tokenHash, row.tokenHash));
    return row;
  });
}

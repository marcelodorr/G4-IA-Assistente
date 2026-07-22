import { beforeEach, describe, expect, it } from "vitest";
import { aiUsage, conversations, messages, settings, users } from "@/lib/db/schema";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { finishUsage, reserveChatUsage } from "./usage";

describe.skipIf(!process.env.TEST_DATABASE_URL)("usage quotas", () => {
  beforeEach(truncateAll);

  it("reserva cota atomicamente e troca reserva pelo consumo real", async () => {
    const db = await getTestDb();
    const [user] = await db.insert(users).values({ name: "U", email: "quota@sequor.com.br", passwordHash: "x" }).returning();
    const [conversation] = await db.insert(conversations).values({ userId: user.id }).returning();
    const [message] = await db.insert(messages).values({ conversationId: conversation.id, role: "assistant", parts: [], status: "streaming" }).returning();
    const reservation = await reserveChatUsage(db, { userId: user.id, conversationId: conversation.id, messageId: message.id, model: "gpt-5-mini", estimatedInputTokens: 100, maxOutputTokens: 200 });
    expect(reservation.reservedTokens).toBe(300);
    await finishUsage(db, reservation.id, { inputTokens: 80, outputTokens: 40, durationMs: 10, success: true });
    const [row] = await db.select().from(aiUsage);
    expect(row).toMatchObject({ inputTokens: 80, outputTokens: 40, reservedTokens: 0, success: true });
  });

  it("retorna 429 quando a instalação excederia a cota", async () => {
    const db = await getTestDb();
    await db.insert(settings).values({ id: 1, dailyTokenLimit: 1_000, monthlyTokenLimit: 1_000 });
    const [user] = await db.insert(users).values({ name: "U", email: "limite@sequor.com.br", passwordHash: "x" }).returning();
    const [conversation] = await db.insert(conversations).values({ userId: user.id }).returning();
    const [message] = await db.insert(messages).values({ conversationId: conversation.id, role: "assistant", parts: [], status: "streaming" }).returning();
    await expect(reserveChatUsage(db, { userId: user.id, conversationId: conversation.id, messageId: message.id, model: "gpt-5-mini", estimatedInputTokens: 900, maxOutputTokens: 200 }))
      .rejects.toMatchObject({ status: 429 });
  });
});

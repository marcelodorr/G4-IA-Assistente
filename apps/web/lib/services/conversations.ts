import { and, asc, desc, eq } from "drizzle-orm";
import { conversations, messages } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

export async function createConversation(db: Db, input: { userId: string; assistantId?: string | null; model?: string | null }) {
  const [row] = await db.insert(conversations).values({
    userId: input.userId, assistantId: input.assistantId ?? null, model: input.model ?? null,
  }).returning();
  return row;
}

export async function listConversations(db: Db, userId: string) {
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
}

export async function getConversation(db: Db, id: string, userId: string) {
  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  if (!conv) return null;
  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  return { conversation: conv, messages: msgs };
}

export async function deleteConversation(db: Db, id: string, userId: string) {
  await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

type UiMsg = { role: "user" | "assistant"; parts: unknown };

export async function replaceMessages(db: Db, conversationId: string, uiMessages: UiMsg[]) {
  await db.transaction(async (tx) => {
    await tx.delete(messages).where(eq(messages.conversationId, conversationId));
    if (uiMessages.length > 0) {
      // createdAt escalonado preserva a ordem na releitura
      const base = Date.now();
      await tx.insert(messages).values(uiMessages.map((m, i) => ({
        conversationId, role: m.role, parts: m.parts, createdAt: new Date(base + i),
      })));
    }
    await tx.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  });
}

export async function setConversationTitle(db: Db, id: string, title: string) {
  await db.update(conversations).set({ title }).where(eq(conversations.id, id));
}

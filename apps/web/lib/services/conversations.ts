import { and, asc, desc, eq, lt } from "drizzle-orm";
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
  // Um processo encerrado durante o streaming não consegue executar callbacks.
  // Na próxima abertura, transforma respostas antigas presas em estado recuperável.
  await db.update(messages).set({
    status: "interrupted",
    error: "Resposta interrompida por reinício ou perda de conexão",
    updatedAt: new Date(),
  }).where(and(
    eq(messages.conversationId, id),
    eq(messages.status, "streaming"),
    lt(messages.updatedAt, new Date(Date.now() - 5 * 60_000)),
  ));
  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  return { conversation: conv, messages: msgs };
}

export async function deleteConversation(db: Db, id: string, userId: string) {
  await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function appendChatTurn(db: Db, input: { conversationId: string; clientId: string; userParts: unknown }) {
  return db.transaction(async (tx) => {
    const createdAt = new Date();
    const [userMessage] = await tx.insert(messages).values({
      conversationId: input.conversationId,
      role: "user",
      parts: input.userParts,
      clientId: input.clientId,
      status: "completed",
      createdAt,
      updatedAt: createdAt,
    }).onConflictDoNothing().returning();
    if (!userMessage) throw new Error("Esta mensagem já foi processada");
    const [assistantMessage] = await tx.insert(messages).values({
      conversationId: input.conversationId,
      role: "assistant",
      parts: [],
      status: "streaming",
      createdAt: new Date(createdAt.getTime() + 1),
      updatedAt: new Date(createdAt.getTime() + 1),
    }).returning();
    await tx.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, input.conversationId));
    return { userMessage, assistantMessage };
  });
}

export async function finishAssistantMessage(db: Db, id: string, input: {
  parts: unknown;
  status: "completed" | "interrupted";
  error?: string | null;
}) {
  await db.update(messages).set({
    parts: input.parts,
    status: input.status,
    error: input.error?.slice(0, 500) ?? null,
    updatedAt: new Date(),
  }).where(eq(messages.id, id));
}

export async function getCompletedMessages(db: Db, conversationId: string) {
  return db.select().from(messages).where(and(
    eq(messages.conversationId, conversationId),
    eq(messages.status, "completed"),
  )).orderBy(asc(messages.createdAt));
}

/** O chamador DEVE validar a propriedade da conversa (getConversation) antes. */
export async function setConversationTitle(db: Db, id: string, title: string) {
  await db.update(conversations).set({ title }).where(eq(conversations.id, id));
}

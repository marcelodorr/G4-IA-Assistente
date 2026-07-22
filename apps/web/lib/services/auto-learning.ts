import { and, eq, inArray, isNull } from "drizzle-orm";
import { chatUploads, conversations, corporateMemories, globalContextFiles, messages } from "@/lib/db/schema";
import { KB_MIMES } from "@/lib/files/storage";
import { startGlobalContextIngestion } from "@/lib/rag/ingest";
import { captureCorporateMemory } from "@/lib/services/corporate-memory";
import type { Db } from "@/lib/db";

function messageText(parts: unknown) {
  if (!Array.isArray(parts)) return "";
  return parts.filter((part): part is { type: "text"; text: string } => Boolean(
    part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part && typeof part.text === "string",
  )).map((part) => part.text).join("\n").trim();
}

export async function backfillCorporateKnowledge(db: Db) {
  const uploads = await db.select({ upload: chatUploads }).from(chatUploads)
    .leftJoin(globalContextFiles, eq(globalContextFiles.sourceUploadId, chatUploads.id))
    .where(and(isNull(globalContextFiles.id), inArray(chatUploads.mime, KB_MIMES))).limit(50);
  let filesQueued = 0;
  for (const { upload } of uploads) {
    const [file] = await db.insert(globalContextFiles).values({
      filename: upload.filename,
      mime: upload.mime,
      size: upload.size,
      storagePath: upload.storedName,
      createdBy: upload.userId,
      sourceType: "chat_upload",
      sourceUserId: upload.userId,
      sourceConversationId: upload.conversationId,
      sourceUploadId: upload.id,
    }).onConflictDoNothing({ target: globalContextFiles.sourceUploadId }).returning();
    if (file) { filesQueued += 1; startGlobalContextIngestion(db, file.id); }
  }

  const historicalMessages = await db.select({
    id: messages.id,
    parts: messages.parts,
    conversationId: messages.conversationId,
    userId: conversations.userId,
  }).from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .leftJoin(corporateMemories, eq(corporateMemories.messageId, messages.id))
    .where(and(eq(messages.role, "user"), isNull(corporateMemories.id))).limit(100);
  let memoriesQueued = 0;
  for (const message of historicalMessages) {
    const content = messageText(message.parts);
    if (!content) continue;
    const memory = await captureCorporateMemory(db, { userId: message.userId, conversationId: message.conversationId, messageId: message.id, content });
    if (memory) memoriesQueued += 1;
  }
  return { filesQueued, memoriesQueued, hasMore: uploads.length === 50 || historicalMessages.length === 100 };
}

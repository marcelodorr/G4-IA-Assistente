import { stepCountIs, streamText } from "ai";
import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { getConversation, replaceMessages, setConversationTitle } from "@/lib/services/conversations";
import { getSettings } from "@/lib/services/settings";
import { getProvider } from "@/lib/ai/provider";
import { prepareModelMessages } from "@/lib/ai/prepare-messages";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { generateConversationTitle } from "@/lib/ai/title";
import { assistants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 300;

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const { messages: uiMessages, conversationId } = await req.json();

  const got = await getConversation(db, conversationId, session.user.id);
  if (!got) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });

  const settings = await getSettings(db);
  const openai = await getProvider(db);
  const assistant = got.conversation.assistantId
    ? (await db.select().from(assistants).where(eq(assistants.id, got.conversation.assistantId)))[0]
    : null;
  const modelId = got.conversation.model ?? assistant?.model ?? settings.defaultModel;

  const result = streamText({
    // .chat() força a API de chat completions (necessário para o mock do e2e da Parte 2)
    model: openai.chat(modelId),
    system: assistant?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    messages: await prepareModelMessages(uiMessages),
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: uiMessages,
    onFinish: async ({ messages: finalMessages }) => {
      try {
        const persistable = finalMessages
          .filter((m: any) => m.role === "user" || m.role === "assistant")
          .map((m: any) => ({ role: m.role, parts: m.parts }));
        await replaceMessages(db, conversationId, persistable);
        if (!got.conversation.title) {
          const firstText = (uiMessages[0]?.parts ?? []).find((p: any) => p.type === "text")?.text ?? "Nova conversa";
          const title = await generateConversationTitle(openai.chat(settings.defaultModel), firstText).catch(() => null);
          if (title) await setConversationTitle(db, conversationId, title);
        }
      } catch (e) {
        console.error("[chat] falha ao persistir conversa", conversationId, e);
      }
    },
  });
});

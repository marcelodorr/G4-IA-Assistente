import { stepCountIs, streamText, isTextUIPart, type UIMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import {
  appendChatTurn,
  finishAssistantMessage,
  getCompletedMessages,
  getConversation,
  setConversationTitle,
} from "@/lib/services/conversations";
import { getSettings } from "@/lib/services/settings";
import { finishUsage, recordCompletedChatUsage, recordEmbeddingUsage, reserveChatUsage } from "@/lib/services/usage";
import { getProvider } from "@/lib/ai/provider";
import { prepareModelMessages } from "@/lib/ai/prepare-messages";
import { CHAT_LIMITS, estimateTokens, limitConversationContext, validateNewUserMessage } from "@/lib/ai/chat-policy";
import { getModelPolicy, isModelEnabled } from "@/lib/ai/models";
import { composeSystemPrompt } from "@/lib/ai/system-prompt";
import { generateConversationTitle } from "@/lib/ai/title";
import { makeKnowledgeTool } from "@/lib/ai/knowledge-tool";
import { assistants, chatUploads } from "@/lib/db/schema";
import { hasReadyKnowledge } from "@/lib/rag/search";
import { getPublicError } from "@/lib/errors/public-error";
import { canUserAccessAssistant } from "@/lib/services/assistants";
import { filterUserModels, getUserAccess } from "@/lib/services/users";
import { SUPPORTED_MODELS } from "@/lib/ai/models";
import { getGlobalContext } from "@/lib/services/global-context";

export const maxDuration = 150;

type ChatRequestBody = { message?: unknown; conversationId?: unknown };

function toUiMessages(rows: Awaited<ReturnType<typeof getCompletedMessages>>): UIMessage[] {
  return rows.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts,
  })) as UIMessage[];
}

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const body = (await req.json().catch(() => ({}))) as ChatRequestBody;
  if (typeof body.conversationId !== "string") throw new Error("Conversa inválida");
  const newMessage = validateNewUserMessage(body.message);

  const got = await getConversation(db, body.conversationId, session.user.id);
  if (!got) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });

  const [settings, userAccess, globalContext] = await Promise.all([
    getSettings(db),
    getUserAccess(db, session.user.id),
    getGlobalContext(db),
  ]);
  const assistant = got.conversation.assistantId
    ? (await db.select().from(assistants).where(eq(assistants.id, got.conversation.assistantId)))[0]
    : null;
  const modelId = got.conversation.model ?? assistant?.model ?? settings.defaultModel;
  const globallyEnabled = SUPPORTED_MODELS.filter((model) => isModelEnabled(model, settings.disabledModels));
  const userModels = filterUserModels(globallyEnabled, userAccess.allowedModels);
  if (!userModels.includes(modelId)) {
    return Response.json({ error: "O modelo desta conversa não está liberado para seu usuário." }, { status: 403 });
  }
  if (assistant && !(await canUserAccessAssistant(db, session.user.id, assistant.id))) {
    return Response.json({ error: "Este assistente não está mais liberado para seu usuário." }, { status: 403 });
  }
  const modelPolicy = getModelPolicy(modelId)!;
  const temBase = await hasReadyKnowledge(db, assistant?.id ?? null);
  const systemPrompt = composeSystemPrompt({ globalContext, assistantPrompt: assistant?.systemPrompt, hasKnowledge: temBase });

  const storedNames = newMessage.parts
    .filter((part) => part.type === "file")
    .map((part) => part.url.slice("/api/files/".length));
  if (storedNames.length > 0) {
    const owned = await db.select({ storedName: chatUploads.storedName }).from(chatUploads).where(and(
      eq(chatUploads.userId, session.user.id),
    ));
    const ownedNames = new Set(owned.map((item) => item.storedName));
    if (storedNames.some((name) => !ownedNames.has(name))) throw new Error("Anexo não encontrado ou sem permissão");
  }

  const turn = await appendChatTurn(db, {
    conversationId: body.conversationId,
    clientId: newMessage.id,
    userParts: newMessage.parts,
  });
  const history = limitConversationContext(toUiMessages(await getCompletedMessages(db, body.conversationId)));
  const maxOutputTokens = Math.min(settings.maxOutputTokens, modelPolicy.maxOutputTokens);
  const startedAt = Date.now();
  let reservation: Awaited<ReturnType<typeof reserveChatUsage>> | null = null;

  try {
    reservation = await reserveChatUsage(db, {
      userId: session.user.id,
      conversationId: body.conversationId,
      messageId: turn.assistantMessage.id,
      model: modelId,
      estimatedInputTokens: estimateTokens(history) + Math.ceil(systemPrompt.length / 4),
      maxOutputTokens,
    });

    const openai = await getProvider(db);
    const modelMessages = await prepareModelMessages(history, undefined, {
      allowImages: modelPolicy.acceptsImages,
      authorizeFile: async (storedName) => storedNames.includes(storedName) || Boolean(
        await db.select({ id: chatUploads.id }).from(chatUploads).where(and(
          eq(chatUploads.storedName, storedName),
          eq(chatUploads.userId, session.user.id),
        )).limit(1).then((rows) => rows[0]),
      ),
    });
    let knowledgeCalls = 0;
    const tools = temBase && modelPolicy.supportsTools ? {
      buscarConhecimento: makeKnowledgeTool(db, openai, assistant?.id ?? null, {
        beforeCall: () => {
          knowledgeCalls += 1;
          if (knowledgeCalls > CHAT_LIMITS.maxToolCalls) throw new Error("Limite de consultas à base de conhecimento atingido");
        },
        onEmbeddingUsage: (usage) => recordEmbeddingUsage(db, {
          ...usage,
          userId: session.user.id,
          conversationId: body.conversationId as string,
        }),
      }),
    } : undefined;
    let failurePersistence: Promise<void> | null = null;
    const markInterrupted = (reason: string) => {
      failurePersistence ??= (async () => {
        await Promise.all([
          finishAssistantMessage(db, turn.assistantMessage.id, { parts: [], status: "interrupted", error: reason }),
          finishUsage(db, reservation!.id, { durationMs: Date.now() - startedAt, success: false, error: reason }),
        ]);
      })();
      return failurePersistence;
    };

    const result = streamText({
      model: openai.chat(modelId),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens,
      stopWhen: stepCountIs(CHAT_LIMITS.maxToolCalls + 1),
      tools,
      timeout: { totalMs: CHAT_LIMITS.totalTimeoutMs, toolMs: 30_000 },
      onError: ({ error }) => markInterrupted(getPublicError(error).message),
      onAbort: () => markInterrupted("Resposta interrompida"),
    });

    return result.toUIMessageStreamResponse({
      generateMessageId: () => turn.assistantMessage.id,
      onEnd: async ({ responseMessage, isAborted, finishReason }) => {
        await failurePersistence;
        const usage = await result.usage;
        const interrupted = isAborted || finishReason === "error";
        await Promise.all([
          finishAssistantMessage(db, turn.assistantMessage.id, {
            parts: responseMessage.parts,
            status: interrupted ? "interrupted" : "completed",
            error: interrupted ? "Resposta interrompida" : null,
          }),
          finishUsage(db, reservation!.id, {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            durationMs: Date.now() - startedAt,
            success: !interrupted,
            error: interrupted ? "Resposta interrompida" : null,
          }),
        ]);
        if (!got.conversation.title) {
          const firstText = newMessage.parts.find(isTextUIPart)?.text ?? "Nova conversa";
          const titleStartedAt = Date.now();
          const titleModel = userModels.includes(settings.defaultModel) ? settings.defaultModel : modelId;
          const title = await generateConversationTitle(openai.chat(titleModel), firstText, (usage) =>
            recordCompletedChatUsage(db, {
              ...usage,
              userId: session.user.id,
              conversationId: body.conversationId as string,
              model: titleModel,
              durationMs: Date.now() - titleStartedAt,
            }),
          ).catch(() => null);
          if (title) await setConversationTitle(db, body.conversationId as string, title);
        }
      },
      onError: (error) => getPublicError(error).message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao iniciar resposta";
    await finishAssistantMessage(db, turn.assistantMessage.id, { parts: [], status: "interrupted", error: message });
    if (reservation) {
      await finishUsage(db, reservation.id, { durationMs: Date.now() - startedAt, success: false, error: message });
    }
    throw error;
  }
});

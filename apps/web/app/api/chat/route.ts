import { stepCountIs, streamText, isTextUIPart, type ToolSet, type UIMessage } from "ai";
import { and, eq, inArray } from "drizzle-orm";
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
import { assistants, chatUploads, globalContextFiles } from "@/lib/db/schema";
import { hasReadyKnowledge } from "@/lib/rag/search";
import { getPublicError } from "@/lib/errors/public-error";
import { canUserAccessAssistant } from "@/lib/services/assistants";
import { filterUserModels, getUserAccess } from "@/lib/services/users";
import { SUPPORTED_MODELS } from "@/lib/ai/models";
import { getGlobalContext } from "@/lib/services/global-context";
import { captureCorporateMemory } from "@/lib/services/corporate-memory";
import { createAgentTools } from "@/lib/ai/agent-tools";
import { AGENT_TYPE_INSTRUCTIONS } from "@/lib/ai/agent-types";
import { createIntegrationTools } from "@/lib/ai/integration-tools";
import { INTEGRATIONS } from "@/lib/integrations/catalog";
import { getPersistentProjectFileContext, getProject } from "@/lib/services/projects";
import { KB_MIMES } from "@/lib/files/storage";
import { startGlobalContextIngestion } from "@/lib/rag/ingest";
import { buildPersonalContext, getOwnProfile } from "@/lib/services/profile";

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

  const [settings, userAccess, globalContext, ownProfile] = await Promise.all([
    getSettings(db),
    getUserAccess(db, session.user.id),
    getGlobalContext(db),
    getOwnProfile(db, session.user.id),
  ]);
  const assistant = got.conversation.assistantId
    ? (await db.select().from(assistants).where(eq(assistants.id, got.conversation.assistantId)))[0]
    : null;
  const project = got.conversation.projectId ? await getProject(db, got.conversation.projectId, session.user.id) : null;
  if (got.conversation.projectId && !project) return Response.json({ error: "Este projeto não está mais disponível." }, { status: 403 });
  const projectFilesContext = project ? await getPersistentProjectFileContext(db, project.id) : "";
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
  const temBase = await hasReadyKnowledge(db, assistant?.id ?? null, project?.id ?? null);
  const agentType = assistant?.agentType ?? "chat";
  const integrationPrompt = assistant?.integrationProvider
    ? `INTEGRAÇÃO PADRÃO DESTE ASSISTENTE: ${INTEGRATIONS[assistant.integrationProvider].name}. Quando a solicitação depender de dados dessa plataforma, use a ferramenta disponível automaticamente. Se a conta do usuário ainda não estiver conectada, explique como conectá-la em Minhas integrações; nunca invente dados.`
    : null;
  const assistantPrompt = [assistant?.systemPrompt, AGENT_TYPE_INSTRUCTIONS[agentType], integrationPrompt].filter(Boolean).join("\n\n");
  const systemPrompt = composeSystemPrompt({
    globalContext,
    userContext: buildPersonalContext(ownProfile),
    projectContext: project?.context,
    projectFilesContext,
    assistantPrompt,
    hasKnowledge: temBase,
  });

  const storedNames = newMessage.parts
    .filter((part) => part.type === "file")
    .map((part) => part.url.slice("/api/files/".length));
  if (storedNames.length > 0) {
    const owned = await db.select().from(chatUploads).where(and(
      eq(chatUploads.userId, session.user.id),
    ));
    const ownedNames = new Set(owned.map((item) => item.storedName));
    if (storedNames.some((name) => !ownedNames.has(name))) throw new Error("Anexo não encontrado ou sem permissão");
    const uploadIds = owned.filter((item) => storedNames.includes(item.storedName)).map((item) => item.id);
    if (uploadIds.length > 0) await Promise.all([
      db.update(chatUploads).set({ conversationId: body.conversationId }).where(inArray(chatUploads.id, uploadIds)),
      db.update(globalContextFiles).set({ sourceConversationId: body.conversationId }).where(inArray(globalContextFiles.sourceUploadId, uploadIds)),
    ]);
    if (settings.autoLearnEnabled && !project) {
      for (const upload of owned.filter((item) => uploadIds.includes(item.id) && KB_MIMES.includes(item.mime))) {
        const [knowledgeFile] = await db.insert(globalContextFiles).values({
          filename: upload.filename,
          mime: upload.mime,
          size: upload.size,
          storagePath: upload.storedName,
          createdBy: session.user.id,
          sourceType: "chat_upload",
          sourceUserId: session.user.id,
          sourceConversationId: body.conversationId,
          sourceUploadId: upload.id,
        }).onConflictDoNothing({ target: globalContextFiles.sourceUploadId }).returning();
        if (knowledgeFile) startGlobalContextIngestion(db, knowledgeFile.id);
      }
    }
  }

  const turn = await appendChatTurn(db, {
    conversationId: body.conversationId,
    clientId: newMessage.id,
    userParts: newMessage.parts,
  });
  if (settings.autoLearnEnabled && !project) {
    const memoryContent = newMessage.parts.filter(isTextUIPart).map((part) => part.text).join("\n");
    if (memoryContent.trim()) void captureCorporateMemory(db, {
      userId: session.user.id,
      conversationId: body.conversationId,
      messageId: turn.userMessage.id,
      content: memoryContent,
    }).catch((error) => console.error("[memória-corporativa] não foi possível registrar a mensagem", error));
  }
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
    const beforeKnowledgeCall = () => {
      knowledgeCalls += 1;
      if (knowledgeCalls > 1) throw new Error("A base de conhecimento já foi consultada nesta resposta");
    };
    let agentCalls = 0;
    const beforeAgentCall = () => {
      agentCalls += 1;
      if (agentCalls > 1) throw new Error("Uma geração já foi iniciada nesta resposta");
    };
    const knowledgeTools: ToolSet = temBase ? {
      buscarConhecimento: makeKnowledgeTool(db, openai, assistant?.id ?? null, project?.id ?? null, {
        beforeCall: () => {
          beforeKnowledgeCall();
        },
        onEmbeddingUsage: (usage) => recordEmbeddingUsage(db, {
          ...usage,
          userId: session.user.id,
          conversationId: body.conversationId as string,
        }),
      }),
    } : {};
    const agentTools = createAgentTools(db, agentType, {
      userId: session.user.id,
      conversationId: body.conversationId,
      assistantId: assistant?.id,
    }, { beforeCall: beforeAgentCall });
    let integrationCalls = 0;
    const integrationTools = await createIntegrationTools(db, { userId: session.user.id, conversationId: body.conversationId, projectId: project?.id }, { providers: assistant?.integrationProvider ? [assistant.integrationProvider] : undefined, beforeCall: () => {
      integrationCalls += 1;
      if (integrationCalls > 4) throw new Error("Limite de consultas a integrações nesta resposta atingido");
    } });
    const webTools: ToolSet = ownProfile.preferences.webSearchEnabled ? {
      web_search: openai.tools.webSearch({ searchContextSize: "medium", externalWebAccess: true }),
    } : {};
    const tools: ToolSet | undefined = modelPolicy.supportsTools ? { ...knowledgeTools, ...agentTools, ...integrationTools, ...webTools } : undefined;
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
      model: ownProfile.preferences.webSearchEnabled ? openai(modelId) : openai.chat(modelId),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens,
      stopWhen: stepCountIs(CHAT_LIMITS.maxToolCalls + 1),
      tools,
      timeout: { totalMs: CHAT_LIMITS.totalTimeoutMs, toolMs: 120_000 },
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

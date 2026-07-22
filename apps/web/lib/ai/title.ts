import { generateText, type LanguageModel } from "ai";

export async function generateConversationTitle(
  model: LanguageModel,
  firstUserText: string,
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => Promise<void>,
): Promise<string> {
  const { text, usage } = await generateText({
    model,
    prompt: `Crie um título curto (máx. 6 palavras, sem aspas) em português para uma conversa que começa com: "${firstUserText.slice(0, 500)}"`,
  });
  await onUsage?.({ inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 });
  return text.replaceAll('"', "").replaceAll("\n", " ").trim().slice(0, 60);
}

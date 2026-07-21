import { generateText, type LanguageModel } from "ai";

export async function generateConversationTitle(model: LanguageModel, firstUserText: string): Promise<string> {
  const { text } = await generateText({
    model,
    prompt: `Crie um título curto (máx. 6 palavras, sem aspas) em português para uma conversa que começa com: "${firstUserText.slice(0, 500)}"`,
  });
  return text.replaceAll('"', "").replaceAll("\n", " ").trim().slice(0, 60);
}

import { describe, it, expect } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { generateConversationTitle } from "./title";

// Adaptação: o brief (escrito para ai@5) usa `MockLanguageModelV2` de "ai/test" com
// `finishReason: "stop"` (string) e `usage: { inputTokens, outputTokens, totalTokens }`
// (números planos). Em ai@7.0.33 instalado, "ai/test" só exporta `MockLanguageModelV3` /
// `MockLanguageModelV4`; `LanguageModelV2` não tem mock correspondente nesta versão.
// `MockLanguageModelV3` é o substituto mais próximo (mesmo formato de `content`/`warnings`),
// mas `finishReason` virou um objeto `{ unified, raw }` e `usage` virou objetos aninhados
// `{ total, noCache, cacheRead, cacheWrite }` / `{ total, text, reasoning }`. Ajustado abaixo
// mantendo a intenção original do teste (mock retorna um texto fixo).
function mockModel(text: string) {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

describe("generateConversationTitle", () => {
  it("retorna título limpo", async () => {
    const t = await generateConversationTitle(mockModel('"Plano de vendas Q3"\n'), "me ajude com vendas");
    expect(t).toBe("Plano de vendas Q3");
  });

  it("trunca títulos longos em 60 chars", async () => {
    const t = await generateConversationTitle(mockModel("x".repeat(200)), "oi");
    expect(t.length).toBeLessThanOrEqual(60);
  });
});

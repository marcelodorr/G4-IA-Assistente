import { describe, expect, it } from "vitest";
import { composeSystemPrompt, DEFAULT_SYSTEM_PROMPT } from "./system-prompt";

describe("composeSystemPrompt", () => {
  it("mantém segurança, contexto global e instruções do assistente na ordem correta", () => {
    const prompt = composeSystemPrompt({
      globalContext: "A empresa atende indústrias.",
      assistantPrompt: "Priorize dúvidas comerciais.",
      hasKnowledge: true,
    });
    expect(prompt.indexOf(DEFAULT_SYSTEM_PROMPT)).toBe(0);
    expect(prompt.indexOf("A empresa atende indústrias.")).toBeLessThan(prompt.indexOf("Priorize dúvidas comerciais."));
    expect(prompt).toContain("buscarConhecimento");
  });

  it("não adiciona seções vazias", () => {
    expect(composeSystemPrompt({ globalContext: " ", assistantPrompt: null, hasKnowledge: false })).toBe(DEFAULT_SYSTEM_PROMPT);
  });
});

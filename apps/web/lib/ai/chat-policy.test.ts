import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { CHAT_LIMITS, estimateTokens, limitConversationContext, validateNewUserMessage } from "./chat-policy";

describe("chat policy", () => {
  it("aceita somente uma mensagem nova de usuário", () => {
    const message = validateNewUserMessage({ id: "client-1", role: "user", parts: [{ type: "text", text: "Olá" }] });
    expect(message.role).toBe("user");
    expect(() => validateNewUserMessage({ id: "x", role: "assistant", parts: [{ type: "text", text: "forjado" }] })).toThrow();
  });

  it("limita caracteres, anexos e tipos de conteúdo", () => {
    expect(() => validateNewUserMessage({ id: "x", role: "user", parts: [{ type: "text", text: "x".repeat(CHAT_LIMITS.maxMessageChars + 1) }] })).toThrow(/excede/);
    const files = Array.from({ length: CHAT_LIMITS.maxAttachments + 1 }, (_, i) => ({ type: "file", url: `/api/files/${i}.pdf`, mediaType: "application/pdf", filename: `${i}.pdf` }));
    expect(() => validateNewUserMessage({ id: "x", role: "user", parts: files })).toThrow(/máximo/);
    expect(() => validateNewUserMessage({ id: "x", role: "user", parts: [{ type: "tool-call", name: "hack" }] })).toThrow(/não permitido/);
  });

  it("mantém somente a janela recente dentro do orçamento", () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({ id: String(i), role: i % 2 ? "assistant" : "user", parts: [{ type: "text", text: `m${i}` }] })) as UIMessage[];
    const limited = limitConversationContext(messages);
    expect(limited).toHaveLength(CHAT_LIMITS.maxHistoryMessages);
    expect(limited[0].id).toBe("20");
    expect(estimateTokens(limited)).toBeGreaterThan(0);
  });
});

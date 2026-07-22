import type { UIMessage } from "ai";

export const CHAT_LIMITS = {
  maxMessageChars: 12_000,
  maxAttachments: 4,
  maxHistoryMessages: 30,
  maxContextChars: 100_000,
  maxToolCalls: 3,
  totalTimeoutMs: 145_000,
} as const;

type SafeFilePart = { type: "file"; url: string; mediaType: string; filename: string };
type SafeTextPart = { type: "text"; text: string };

export function validateNewUserMessage(value: unknown): UIMessage {
  if (!value || typeof value !== "object") throw new Error("Mensagem inválida");
  const raw = value as { id?: unknown; role?: unknown; parts?: unknown };
  if (raw.role !== "user" || typeof raw.id !== "string" || raw.id.length < 1 || raw.id.length > 128) {
    throw new Error("Mensagem inválida");
  }
  if (!Array.isArray(raw.parts) || raw.parts.length === 0) throw new Error("A mensagem está vazia");

  const parts: Array<SafeTextPart | SafeFilePart> = [];
  let textChars = 0;
  let attachments = 0;
  for (const part of raw.parts) {
    if (!part || typeof part !== "object") throw new Error("Parte da mensagem inválida");
    const item = part as Record<string, unknown>;
    if (item.type === "text" && typeof item.text === "string") {
      textChars += item.text.length;
      parts.push({ type: "text", text: item.text });
      continue;
    }
    if (item.type === "file" && typeof item.url === "string" && typeof item.mediaType === "string" && typeof item.filename === "string") {
      attachments += 1;
      if (!item.url.startsWith("/api/files/") || item.filename.length > 255) throw new Error("Anexo inválido");
      parts.push({ type: "file", url: item.url, mediaType: item.mediaType, filename: item.filename });
      continue;
    }
    throw new Error("A mensagem contém um tipo de conteúdo não permitido");
  }
  if (textChars > CHAT_LIMITS.maxMessageChars) throw new Error(`A mensagem excede ${CHAT_LIMITS.maxMessageChars.toLocaleString("pt-BR")} caracteres`);
  if (attachments > CHAT_LIMITS.maxAttachments) throw new Error(`Envie no máximo ${CHAT_LIMITS.maxAttachments} anexos`);
  if (textChars === 0 && attachments === 0) throw new Error("A mensagem está vazia");
  return { id: raw.id, role: "user", parts } as UIMessage;
}

export function limitConversationContext(messages: UIMessage[]): UIMessage[] {
  const recent = messages.slice(-CHAT_LIMITS.maxHistoryMessages);
  const selected: UIMessage[] = [];
  let chars = 0;
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const messageChars = JSON.stringify(recent[i].parts).length;
    if (selected.length > 0 && chars + messageChars > CHAT_LIMITS.maxContextChars) break;
    chars += messageChars;
    selected.unshift(recent[i]);
  }
  return selected;
}

export function estimateTokens(messages: UIMessage[]): number {
  const chars = messages.reduce((total, message) => total + JSON.stringify(message.parts).length, 0);
  return Math.max(1, Math.ceil(chars / 4));
}

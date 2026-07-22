"use client";
import { useEffect, useRef } from "react";
import { FileText } from "lucide-react";
import type { UIMessage } from "ai";
import { Markdown } from "./markdown";

type MessagePart = UIMessage["parts"][number];

function UserFilePart({ part }: { part: Extract<MessagePart, { type: "file" }> }) {
  if (part.mediaType.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element -- URL pode ser data: URL ou arquivo local servido por /api/files
    return <img src={part.url} alt={part.filename ?? "Anexo"} className="max-h-48 rounded-lg" />;
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1 text-xs">
      <FileText className="size-3.5" />
      {part.filename ?? "Arquivo"}
    </span>
  );
}

function UserBubble({ message }: { message: UIMessage }) {
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[80%] flex-col items-end gap-2 rounded-2xl bg-secondary px-4 py-2">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <p key={i} className="whitespace-pre-wrap text-sm">
                {part.text}
              </p>
            );
          }
          if (part.type === "file") {
            return <UserFilePart key={i} part={part} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

// Chip discreto para partes de ferramenta (type "tool-<nome>"). Genérico para
// qualquer ferramenta futura (Task 18 usa "tool-buscarConhecimento").
function ToolChip({ part }: { part: MessagePart }) {
  const state = "state" in part ? part.state : undefined;
  const done = state === "output-available" || state === "output-error" || state === "output-denied";
  const failed = state === "output-error" || state === "output-denied";
  return (
    <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
      {failed ? "Não foi possível consultar a base" : done ? "✓ Base consultada" : "🔎 Consultando base de conhecimento…"}
    </div>
  );
}

function AssistantContent({ parts }: { parts: MessagePart[] }) {
  const nodes: React.ReactNode[] = [];
  let buffer = "";
  let key = 0;

  function flush() {
    if (buffer.trim()) nodes.push(<Markdown key={key++}>{buffer}</Markdown>);
    buffer = "";
  }

  for (const part of parts) {
    if (part.type === "text") {
      buffer += part.text;
    } else if (part.type.startsWith("tool-")) {
      flush();
      nodes.push(<ToolChip key={key++} part={part} />);
    }
    // outras parts (reasoning, source, step-start, etc.) são ignoradas aqui
  }
  flush();

  return <>{nodes}</>;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2" aria-label="Assistente digitando">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function hasVisibleText(message: UIMessage | undefined) {
  return Boolean(
    message?.role === "assistant" &&
      message.parts.some((p) => p.type === "text" && p.text.trim().length > 0)
  );
}

export function MessageList({ messages, streaming, interruptedMessageIds = [] }: { messages: UIMessage[]; streaming: boolean; interruptedMessageIds?: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  const lastMessage = messages[messages.length - 1];
  const showTyping = streaming && !hasVisibleText(lastMessage);
  const interrupted = new Set(interruptedMessageIds);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4" aria-live="polite" aria-busy={streaming}>
      {messages.map((message) =>
        message.role === "user" ? (
          <UserBubble key={message.id} message={message} />
        ) : (
          <div key={message.id} className="w-full">
            <AssistantContent parts={message.parts} />
            {interrupted.has(message.id) && <div role="alert" className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">A resposta foi interrompida. Envie sua mensagem novamente para tentar de novo.</div>}
          </div>
        )
      )}
      {showTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}

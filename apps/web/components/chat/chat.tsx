"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageList } from "./message-list";
import { MessageInput, type Attachment } from "./message-input";
import Link from "next/link";

export function Chat({
  conversationId,
  initialMessages,
  interruptedMessageIds,
  assistantName,
  integrationNames = [],
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  interruptedMessageIds: string[];
  assistantName?: string | null;
  integrationNames?: string[];
}) {
  const router = useRouter();
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { conversationId, message: messages.at(-1) },
      }),
    }),
    messages: initialMessages,
  });
  const enviouPendente = useRef(false);

  // primeira mensagem vinda da página "nova conversa"
  useEffect(() => {
    const pendente = sessionStorage.getItem(`draft:${conversationId}`);
    if (pendente && !enviouPendente.current) {
      enviouPendente.current = true;
      sessionStorage.removeItem(`draft:${conversationId}`);
      const { text, files } = JSON.parse(pendente);
      sendMessage({ text, files });
    }
  }, [conversationId, sendMessage]);

  // atualiza sidebar (título) quando terminar a primeira resposta
  useEffect(() => {
    if (status === "ready" && messages.length === 2) router.refresh();
  }, [status, messages.length, router]);

  useEffect(() => {
    if (error) {
      let message = error.message;
      try {
        const parsed = JSON.parse(message) as { error?: string };
        message = parsed.error ?? message;
      } catch { /* resposta não estruturada */ }
      toast.error(message || "Não foi possível enviar a mensagem");
    }
  }, [error]);

  function onSend(text: string, files: Attachment[]) {
    sendMessage({ text, files: files.length ? files : undefined });
  }

  return (
    <div className="flex h-full flex-col">
      {assistantName && (
        <div className="border-b px-4 py-2 text-sm text-muted-foreground">
          Assistente: <span className="text-primary">{assistantName}</span>
        </div>
      )}
      {integrationNames.length > 0 && (
        <div className="border-b bg-secondary/20 px-4 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Integrações prontas:</span> {integrationNames.join(", ")}. Escreva normalmente o que deseja consultar; o agente escolhe a ferramenta. <Link href="/integracoes" className="text-primary hover:underline">Ver exemplos</Link>
        </div>
      )}
      <MessageList messages={messages} streaming={status === "streaming"} interruptedMessageIds={interruptedMessageIds} />
      <MessageInput onSend={onSend} disabled={status !== "ready" && status !== "error"} />
    </div>
  );
}

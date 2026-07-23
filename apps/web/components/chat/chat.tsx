"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageList } from "./message-list";
import { MessageInput, type Attachment } from "./message-input";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SEM_PROJETO = "__sem_projeto__";

export function Chat({
  conversationId,
  initialMessages,
  interruptedMessageIds,
  assistantName,
  project,
  projects = [],
  integrationNames = [],
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  interruptedMessageIds: string[];
  assistantName?: string | null;
  project?: { id: string; name: string } | null;
  projects?: Array<{ id: string; name: string }>;
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

  async function moveToProject(projectId: string | null) {
    const response = await fetch(`/api/conversations/${conversationId}`, { method: "PATCH", body: JSON.stringify({ projectId }) });
    if (!response.ok) return toast.error((await response.json()).error ?? "Não foi possível mover a conversa");
    toast.success(projectId ? "Conversa movida para o projeto" : "Conversa removida do projeto");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-primary/5 px-4 py-2 text-sm text-muted-foreground"><span className="shrink-0">Projeto:</span><Select disabled={status === "streaming" || status === "submitted"} value={project?.id ?? SEM_PROJETO} onValueChange={(value) => void moveToProject(value === SEM_PROJETO ? null : value)}><SelectTrigger className="h-8 max-w-64 bg-background" aria-label="Mover conversa para projeto"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={SEM_PROJETO}>Sem projeto</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>{project && <><span className="hidden sm:inline">contexto persistente ativo</span><Link href={`/projetos/${project.id}`} className="text-primary hover:underline">Configurar</Link></>}</div>
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

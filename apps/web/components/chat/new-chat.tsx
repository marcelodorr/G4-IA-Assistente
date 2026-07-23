"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { AssistantPicker } from "./assistant-picker";
import { ModelPicker } from "./model-picker";
import { MessageInput, type Attachment } from "./message-input";
import type { AssistantSummary } from "@/lib/services/assistants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SEM_PROJETO = "__sem_projeto__";

export function NewChat({
  assistants,
  projects,
  initialProjectId = null,
  defaultModel,
  models,
  initialPrompt = "",
  integrationSuggestions = [],
}: {
  assistants: AssistantSummary[];
  projects: Array<{ id: string; name: string }>;
  initialProjectId?: string | null;
  defaultModel: string | null;
  models: string[];
  initialPrompt?: string;
  integrationSuggestions?: string[];
}) {
  const router = useRouter();
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [model, setModel] = useState(defaultModel ?? "");
  const [criando, setCriando] = useState(false);

  async function onSend(text: string, files: Attachment[]) {
    if (criando) return;
    if (!model) return toast.error("Nenhum modelo de IA está liberado para seu usuário");
    setCriando(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId, projectId, model }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Erro ao criar conversa");
        setCriando(false);
        return;
      }
      const conv = await res.json();
      sessionStorage.setItem(`draft:${conv.id}`, JSON.stringify({ text, files }));
      router.push(`/c/${conv.id}`);
    } catch {
      toast.error("Erro ao criar conversa");
      setCriando(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="h-10 w-auto" />
        <p className="text-lg text-muted-foreground">Transformando dados em experiências que realmente importam.</p>
      </div>
      <div className="w-full max-w-xl space-y-3">
        {models.length === 0 && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">Nenhum modelo está liberado para seu usuário. Solicite acesso ao administrador.</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={projectId ?? SEM_PROJETO} onValueChange={(value) => setProjectId(value === SEM_PROJETO ? null : value)}><SelectTrigger className="w-full" aria-label="Projeto"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={SEM_PROJETO}>Sem projeto</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>
          <AssistantPicker assistants={assistants} value={assistantId} onChange={setAssistantId} />
          <ModelPicker value={model} onChange={setModel} models={models} />
        </div>
        {projectId && <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Contexto do projeto ativo.</span> Este chat usará automaticamente o contexto, documentos e skills configurados no projeto.</p>}
        {integrationSuggestions.length > 0 && <p className="rounded-lg border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Como usar integrações:</span> escreva seu pedido normalmente. O agente identifica e consulta a plataforma conectada automaticamente — não existe comando especial.</p>}
        <MessageInput onSend={onSend} disabled={criando || models.length === 0} initialText={initialPrompt} suggestions={integrationSuggestions} />
      </div>
    </div>
  );
}

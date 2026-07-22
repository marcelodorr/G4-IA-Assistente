"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { AssistantPicker } from "./assistant-picker";
import { ModelPicker } from "./model-picker";
import { MessageInput, type Attachment } from "./message-input";
import type { AssistantSummary } from "@/lib/services/assistants";

export function NewChat({
  assistants,
  defaultModel,
  models,
}: {
  assistants: AssistantSummary[];
  defaultModel: string;
  models: string[];
}) {
  const router = useRouter();
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [model, setModel] = useState(defaultModel);
  const [criando, setCriando] = useState(false);

  async function onSend(text: string, files: Attachment[]) {
    if (criando) return;
    setCriando(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId, model }),
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <AssistantPicker assistants={assistants} value={assistantId} onChange={setAssistantId} />
          <ModelPicker value={model} onChange={setModel} models={models} />
        </div>
        <MessageInput onSend={onSend} disabled={criando} />
      </div>
    </div>
  );
}

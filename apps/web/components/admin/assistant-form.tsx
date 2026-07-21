"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { SUPPORTED_MODELS } from "@/lib/ai/models";
import type { getAssistant } from "@/lib/services/assistants";

type AssistantRow = NonNullable<Awaited<ReturnType<typeof getAssistant>>>;

const MODELO_PADRAO = "padrao";

export function AssistantForm({ assistant }: { assistant?: AssistantRow }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [name, setName] = useState(assistant?.name ?? "");
  const [description, setDescription] = useState(assistant?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(assistant?.systemPrompt ?? "");
  const [model, setModel] = useState(assistant?.model ?? MODELO_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function resetar(novoAberto: boolean) {
    setAberto(novoAberto);
    if (!novoAberto) {
      setName(""); setDescription(""); setSystemPrompt(""); setModel(MODELO_PADRAO); setErro(null);
    }
  }

  async function salvar() {
    setEnviando(true); setErro(null);
    const body = {
      name,
      description,
      systemPrompt,
      model: model === MODELO_PADRAO ? null : model,
    };
    const res = assistant
      ? await fetch(`/api/assistants/${assistant.id}`, { method: "PATCH", body: JSON.stringify(body) })
      : await fetch("/api/assistants", { method: "POST", body: JSON.stringify(body) });
    setEnviando(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const mensagem = data.error ?? "Erro ao salvar assistente";
      setErro(mensagem);
      toast.error(mensagem);
      return;
    }
    toast.success(assistant ? "Assistente atualizado" : "Assistente criado");
    if (!assistant) resetar(false);
    router.refresh();
  }

  const campos = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="assistant-name">Nome</Label>
        <Input
          id="assistant-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Vendas"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="assistant-description">Descrição</Label>
        <Input
          id="assistant-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Breve descrição (opcional)"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="assistant-prompt">System prompt</Label>
        <Textarea
          id="assistant-prompt"
          className="min-h-40"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Você é um especialista em..."
        />
      </div>
      <div className="space-y-2">
        <Label>Modelo</Label>
        <Select value={model ?? MODELO_PADRAO} onValueChange={setModel}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={MODELO_PADRAO}>Padrão do sistema</SelectItem>
            {SUPPORTED_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <Button
        className="w-full"
        disabled={!name.trim() || !systemPrompt.trim() || enviando}
        onClick={salvar}
      >
        {enviando ? "Salvando..." : assistant ? "Salvar alterações" : "Criar assistente"}
      </Button>
    </div>
  );

  if (assistant) return campos;

  return (
    <Dialog open={aberto} onOpenChange={resetar}>
      <DialogTrigger asChild>
        <Button>Novo assistente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo assistente</DialogTitle>
          <DialogDescription>Configure o nome, o comportamento e o modelo do assistente.</DialogDescription>
        </DialogHeader>
        {campos}
      </DialogContent>
    </Dialog>
  );
}

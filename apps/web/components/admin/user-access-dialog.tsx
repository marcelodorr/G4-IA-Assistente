"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MODEL_POLICIES } from "@/lib/ai/models";
import type { listUsers } from "@/lib/services/users";

type UserRow = Awaited<ReturnType<typeof listUsers>>[number];
type AssistantOption = { id: string; name: string; active: boolean };

export function UserAccessDialog({
  user,
  assistants,
  enabledModels,
  globalQuotas,
  onSaved,
}: {
  user: UserRow;
  assistants: AssistantOption[];
  enabledModels: string[];
  globalQuotas: { daily: number; weekly: number; monthly: number };
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [daily, setDaily] = useState(user.dailyTokenLimit?.toString() ?? "");
  const [weekly, setWeekly] = useState(user.weeklyTokenLimit?.toString() ?? "");
  const [monthly, setMonthly] = useState(user.monthlyTokenLimit?.toString() ?? "");
  const [modelMode, setModelMode] = useState<"all" | "selected">(user.allowedModels === null ? "all" : "selected");
  const [models, setModels] = useState(user.allowedModels ?? enabledModels);
  const [assistantMode, setAssistantMode] = useState<"all" | "selected">(user.assistantAccessMode);
  const [assistantIds, setAssistantIds] = useState(user.assistantIds);

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function save() {
    setSaving(true);
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        dailyTokenLimit: daily ? Number(daily) : null,
        weeklyTokenLimit: weekly ? Number(weekly) : null,
        monthlyTokenLimit: monthly ? Number(monthly) : null,
        allowedModels: modelMode === "all" ? null : models,
        assistantAccessMode: assistantMode,
        assistantIds: assistantMode === "all" ? [] : assistantIds,
      }),
    });
    setSaving(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao salvar acessos");
    toast.success("Limites e acessos atualizados");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Acessos e limites</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{user.name}</DialogTitle><DialogDescription>Controle individual de consumo, modelos e assistentes. Campos vazios de cota herdam o limite geral.</DialogDescription></DialogHeader>

        <section className="space-y-3 rounded-lg border p-4">
          <div><h3 className="font-medium">Limites de tokens</h3><p className="text-xs text-muted-foreground">Herança atual: {globalQuotas.daily.toLocaleString("pt-BR")}/dia, {globalQuotas.weekly.toLocaleString("pt-BR")}/semana e {globalQuotas.monthly.toLocaleString("pt-BR")}/mês.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2"><Label htmlFor={`daily-${user.id}`}>Diário</Label><Input id={`daily-${user.id}`} type="number" min={1000} value={daily} placeholder={String(globalQuotas.daily)} onChange={(event) => setDaily(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor={`weekly-${user.id}`}>Semanal</Label><Input id={`weekly-${user.id}`} type="number" min={1000} value={weekly} placeholder={String(globalQuotas.weekly)} onChange={(event) => setWeekly(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor={`monthly-${user.id}`}>Mensal</Label><Input id={`monthly-${user.id}`} type="number" min={1000} value={monthly} placeholder={String(globalQuotas.monthly)} onChange={(event) => setMonthly(event.target.value)} /></div>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-medium">Modelos disponíveis</h3><p className="text-xs text-muted-foreground">A disponibilidade geral da instalação continua tendo prioridade.</p></div><Select value={modelMode} onValueChange={(value) => setModelMode(value as "all" | "selected")}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os habilitados</SelectItem><SelectItem value="selected">Selecionar modelos</SelectItem></SelectContent></Select></div>
          {modelMode === "selected" && <div className="grid gap-2 sm:grid-cols-2">{enabledModels.map((model) => {
            const policy = MODEL_POLICIES.find((item) => item.id === model);
            return <label key={model} className="flex items-center gap-2 rounded-md border p-3"><input type="checkbox" checked={models.includes(model)} onChange={() => toggle(models, model, setModels)} /><span>{policy?.label ?? model}</span></label>;
          })}</div>}
        </section>

        <section className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-medium">Assistentes visíveis</h3><p className="text-xs text-muted-foreground">Assistentes inativos permanecem ocultos mesmo quando selecionados.</p></div><Select value={assistantMode} onValueChange={(value) => setAssistantMode(value as "all" | "selected")}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os assistentes</SelectItem><SelectItem value="selected">Selecionar assistentes</SelectItem></SelectContent></Select></div>
          {assistantMode === "selected" && <div className="grid gap-2 sm:grid-cols-2">{assistants.map((assistant) => <label key={assistant.id} className="flex items-center justify-between gap-2 rounded-md border p-3"><span>{assistant.name}{!assistant.active && <span className="ml-2 text-xs text-muted-foreground">inativo</span>}</span><input type="checkbox" checked={assistantIds.includes(assistant.id)} onChange={() => toggle(assistantIds, assistant.id, setAssistantIds)} /></label>)}</div>}
        </section>

        <DialogFooter showCloseButton><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar acessos"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

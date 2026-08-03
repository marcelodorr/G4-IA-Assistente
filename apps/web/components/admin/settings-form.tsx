"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { MODEL_POLICIES } from "@/lib/ai/models";
import type { getSettings } from "@/lib/services/settings";
import { useRouter } from "next/navigation";

type AiSettings = Awaited<ReturnType<typeof getSettings>>;

export function SettingsForm({ settings }: { settings: AiSettings }) {
  const router = useRouter();
  const [openaiKey, setOpenaiKey] = useState("");
  const [elevenlabsKey, setElevenlabsKey] = useState("");
  const [modelo, setModelo] = useState(settings.defaultModel);
  const [dailyTokenLimit, setDailyTokenLimit] = useState(settings.dailyTokenLimit);
  const [weeklyTokenLimit, setWeeklyTokenLimit] = useState(settings.weeklyTokenLimit);
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState(settings.monthlyTokenLimit);
  const [maxOutputTokens, setMaxOutputTokens] = useState(settings.maxOutputTokens);
  const [disabledModels, setDisabledModels] = useState(settings.disabledModels);
  const [systemVersion, setSystemVersion] = useState(settings.systemVersion);
  const [salvando, setSalvando] = useState(false);

  function toggleModel(model: string) {
    setDisabledModels((current) => current.includes(model) ? current.filter((item) => item !== model) : [...current, model]);
  }

  async function salvar() {
    setSalvando(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openaiKey: openaiKey.trim() || undefined, elevenlabsKey: elevenlabsKey.trim() || undefined, defaultModel: modelo, dailyTokenLimit, weeklyTokenLimit, monthlyTokenLimit, maxOutputTokens, disabledModels, systemVersion }),
    });
    setSalvando(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao salvar configurações");
      return;
    }
    setOpenaiKey("");
    setElevenlabsKey("");
    toast.success("Configurações salvas");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identificação do sistema</CardTitle>
          <CardDescription>A versão aparece ao lado do logotipo para todos os usuários.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="settings-system-version">Versão</Label>
          <Input id="settings-system-version" value={systemVersion} maxLength={40} onChange={(event) => setSystemVersion(event.target.value)} placeholder="Ex.: 1.0.0" />
          <p className="text-xs text-muted-foreground">Use letras, números, ponto, hífen, sublinhado ou “+”.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>ElevenLabs</CardTitle>
          <CardDescription>{settings.hasElevenLabsKey ? "Uma chave já está configurada para transcrição em tempo real." : "Configure a chave para habilitar a captura universal de reuniões."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="settings-elevenlabs-key">Nova chave ElevenLabs</Label>
          <Input id="settings-elevenlabs-key" type="password" value={elevenlabsKey} onChange={(event) => setElevenlabsKey(event.target.value)} placeholder="Deixe em branco para manter" autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">A chave fica criptografada e nunca é enviada ao navegador. O cliente recebe apenas tokens temporários de uso único.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>OpenAI</CardTitle>
          <CardDescription>{settings.hasKey ? "Uma chave já está configurada." : "Nenhuma chave configurada ainda."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-openai-key">Nova chave OpenAI</Label>
            <Input id="settings-openai-key" type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-... (deixe em branco para manter)" />
          </div>
          <div className="space-y-2">
            <Label>Modelo padrão</Label>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{MODEL_POLICIES.filter((m) => !disabledModels.includes(m.id)).map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Limites de consumo</CardTitle>
          <CardDescription>As cotas contabilizam tokens de entrada e saída e bloqueiam novas chamadas antes do excesso.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2"><Label>Tokens por dia</Label><Input type="number" min={1000} value={dailyTokenLimit} onChange={(e) => setDailyTokenLimit(Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Tokens por semana</Label><Input type="number" min={dailyTokenLimit} value={weeklyTokenLimit} onChange={(e) => setWeeklyTokenLimit(Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Tokens por mês</Label><Input type="number" min={weeklyTokenLimit} value={monthlyTokenLimit} onChange={(e) => setMonthlyTokenLimit(Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Máximo por resposta</Label><Input type="number" min={128} max={16384} value={maxOutputTokens} onChange={(e) => setMaxOutputTokens(Number(e.target.value))} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Modelos disponíveis</CardTitle><CardDescription>Desabilite modelos caros ou que não devem ser usados nesta instalação.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {MODEL_POLICIES.map((model) => (
            <label key={model.id} className="flex items-center justify-between rounded-md border p-3">
              <span><span className="font-medium">{model.label}</span><span className="ml-2 text-xs text-muted-foreground">{model.expensive ? "custo alto" : "econômico"}</span></span>
              <input type="checkbox" checked={!disabledModels.includes(model.id)} disabled={model.id === modelo} onChange={() => toggleModel(model.id)} aria-label={`Habilitar ${model.label}`} />
            </label>
          ))}
        </CardContent>
      </Card>
      <Button className="w-full" disabled={salvando} onClick={salvar}>{salvando ? "Salvando..." : "Salvar configurações"}</Button>
    </div>
  );
}

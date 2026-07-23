"use client";

import { useEffect, useState } from "react";
import { CheckCircle2Icon, PlugIcon, UnplugIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IntegrationProvider } from "@/lib/integrations/catalog";

type IntegrationItem = {
  id: IntegrationProvider; name: string; description: string; authType: "oauth" | "token"; color: string;
  setupSteps: string[]; docsUrl: string; connected: boolean; status: string; accountLabel: string | null;
  lastUsedAt: string | Date | null; lastError: string | null;
};

function Wizard({ integration, open, onOpenChange, onChanged }: { integration: IntegrationItem; open: boolean; onOpenChange: (open: boolean) => void; onChanged: () => Promise<void> }) {
  const [step, setStep] = useState(integration.connected ? 3 : 1);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    const response = await fetch(`/api/integrations/${integration.id}/connect`, {
      method: "POST", headers: integration.authType === "token" ? { "Content-Type": "application/json" } : undefined,
      body: integration.authType === "token" ? JSON.stringify({ token }) : undefined,
    });
    setBusy(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Não foi possível conectar");
    const result = await response.json() as { authorizationUrl?: string; connected?: boolean };
    if (result.authorizationUrl) window.location.assign(result.authorizationUrl);
    else { setToken(""); setStep(3); await onChanged(); toast.success(`${integration.name} conectado`); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Conectar {integration.name}</DialogTitle><DialogDescription>Etapa {step} de 3 — a autorização pertence somente à sua conta.</DialogDescription></DialogHeader>
    {step === 1 && <div className="space-y-4"><div className="rounded-lg border p-4"><h3 className="font-medium">O que será disponibilizado</h3><p className="mt-1 text-sm text-muted-foreground">{integration.description} O agente poderá consultar esses dados no chat apenas quando necessário.</p></div><div><h3 className="text-sm font-medium">Antes de começar</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">{integration.setupSteps.map((item) => <li key={item}>{item}</li>)}</ol></div></div>}
    {step === 2 && <div className="space-y-4">{integration.authType === "oauth" ? <div className="rounded-lg border p-4 text-sm"><p>Você será direcionado para {integration.name} para escolher a conta e autorizar acesso somente de leitura.</p><p className="mt-2 text-muted-foreground">A Sequor não recebe sua senha. Tokens de acesso e renovação são armazenados criptografados.</p></div> : <div className="space-y-2"><Label htmlFor={`token-${integration.id}`}>Token pessoal da Apify</Label><Input id={`token-${integration.id}`} type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="apify_api_..." autoComplete="off" /><p className="text-xs text-muted-foreground">Encontre em Apify Console → Settings → API & Integrations. O token será validado e criptografado.</p></div>}<a className="text-sm text-primary hover:underline" href={integration.docsUrl} target="_blank" rel="noreferrer">Ver documentação oficial</a></div>}
    {step === 3 && <div className="space-y-4 text-center"><CheckCircle2Icon className="mx-auto size-12 text-emerald-500" /><div><h3 className="font-medium">Integração conectada</h3><p className="text-sm text-muted-foreground">{integration.accountLabel ?? `${integration.name} está pronta para uso no chat.`}</p></div><div className="rounded-lg bg-secondary/50 p-3 text-left text-sm">Experimente perguntar ao agente por dados da sua conta. A ferramenta de integração será chamada automaticamente durante a resposta.</div></div>}
    <DialogFooter>{step > 1 && step < 3 && <Button variant="outline" onClick={() => setStep(step - 1)}>Voltar</Button>}{step === 1 && <Button onClick={() => setStep(2)}>Continuar</Button>}{step === 2 && <Button disabled={busy || (integration.authType === "token" && token.trim().length < 20)} onClick={() => void connect()}>{busy ? "Conectando..." : integration.authType === "oauth" ? `Autorizar no ${integration.name}` : "Validar e conectar"}</Button>}{step === 3 && <Button onClick={() => onOpenChange(false)}>Concluir</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}

export function IntegrationWizardList({ initialIntegrations, notice }: { initialIntegrations: IntegrationItem[]; notice?: { success?: string; error?: string } }) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [selected, setSelected] = useState<IntegrationItem | null>(null);
  useEffect(() => { if (notice?.success) toast.success(`${notice.success} conectado com sucesso`); if (notice?.error) toast.error(notice.error); }, [notice]);
  async function refresh() {
    const response = await fetch("/api/integrations", { cache: "no-store" });
    if (response.ok) {
      const next = await response.json() as IntegrationItem[];
      setIntegrations(next);
      if (selected) setSelected(next.find((item) => item.id === selected.id) ?? null);
    }
  }
  async function disconnect(item: IntegrationItem) {
    if (!window.confirm(`Desconectar ${item.name}?`)) return;
    const response = await fetch(`/api/integrations/${item.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Não foi possível desconectar");
    await refresh(); toast.success(`${item.name} desconectado`);
  }
  return <><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{integrations.map((item) => <Card key={item.id} className="overflow-hidden"><div className="h-1" style={{ backgroundColor: item.color }} /><CardHeader><div className="flex items-start justify-between gap-2"><div><CardTitle>{item.name}</CardTitle><CardDescription>{item.description}</CardDescription></div><Badge variant={item.connected ? "default" : "outline"}>{item.connected ? "Conectada" : "Disponível"}</Badge></div></CardHeader><CardContent className="space-y-3">{item.connected && <div className="text-sm"><p className="font-medium">{item.accountLabel}</p>{item.lastUsedAt && <p className="text-xs text-muted-foreground">Último uso: {new Date(item.lastUsedAt).toLocaleString("pt-BR")}</p>}{item.lastError && <p className="mt-1 text-xs text-destructive">{item.lastError}</p>}</div>}<div className="flex gap-2"><Button className="flex-1" variant={item.connected ? "outline" : "default"} onClick={() => setSelected(item)}><PlugIcon />{item.connected ? "Ver conexão" : "Conectar"}</Button>{item.connected && <Button size="icon" variant="ghost" aria-label={`Desconectar ${item.name}`} onClick={() => void disconnect(item)}><UnplugIcon /></Button>}</div></CardContent></Card>)}</div>{integrations.length === 0 && <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma integração foi liberada para seu usuário. Solicite acesso ao administrador.</CardContent></Card>}{selected && <Wizard integration={selected} open onOpenChange={(open) => { if (!open) setSelected(null); }} onChanged={refresh} />}</>;
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2Icon, CopyIcon, MessageCircleIcon, PlugIcon, UnplugIcon } from "lucide-react";
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
  userSteps: string[]; capabilities: string[]; examplePrompts: string[]; limitations: string[];
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

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{integration.connected ? `Como usar ${integration.name}` : `Conectar ${integration.name}`}</DialogTitle><DialogDescription>Etapa {step} de 3 — não é necessário decorar comandos técnicos.</DialogDescription></DialogHeader>
    {step === 1 && <div className="space-y-4"><div className="rounded-lg border p-4"><h3 className="font-medium">O que você consegue consultar</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{integration.capabilities.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3 className="text-sm font-medium">Exemplos do que escrever no chat</h3><div className="mt-2 space-y-2">{integration.examplePrompts.slice(0, 3).map((prompt) => <p key={prompt} className="rounded-lg bg-secondary/50 p-2.5 text-sm">“{prompt}”</p>)}</div></div><div className="rounded-lg border border-amber-500/30 p-3"><h3 className="text-sm font-medium">O que esta integração não faz</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{integration.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3 className="text-sm font-medium">Como conectar — passo a passo</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">{integration.userSteps.map((item) => <li key={item}>{item}</li>)}</ol></div><div className="rounded-lg bg-primary/5 p-3 text-sm"><span className="font-medium">Importante:</span> depois de conectar, basta escrever normalmente. O agente chama {integration.name} sozinho.</div></div>}
    {step === 2 && <div className="space-y-4">{integration.authType === "oauth" ? <div className="rounded-lg border p-4 text-sm"><p>Você será direcionado para {integration.name} para escolher a conta e autorizar acesso somente de leitura.</p><p className="mt-2 text-muted-foreground">A Sequor não recebe sua senha. Tokens de acesso e renovação são armazenados criptografados.</p></div> : <div className="space-y-2"><Label htmlFor={`token-${integration.id}`}>Token pessoal da Apify</Label><Input id={`token-${integration.id}`} type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="apify_api_..." autoComplete="off" /><p className="text-xs text-muted-foreground">Encontre em Apify Console → Settings → API & Integrations. O token será validado e criptografado.</p></div>}<a className="text-sm text-primary hover:underline" href={integration.docsUrl} target="_blank" rel="noreferrer">Ver documentação oficial</a></div>}
    {step === 3 && <div className="space-y-4"><div className="text-center"><CheckCircle2Icon className="mx-auto size-10 text-emerald-500" /><h3 className="mt-2 font-medium">{integration.name} está pronta</h3><p className="text-sm text-muted-foreground">{integration.accountLabel ?? "Conta conectada"}</p></div><div><h3 className="text-sm font-medium">Perguntas prontas para usar</h3><div className="mt-2 space-y-2">{integration.examplePrompts.map((prompt) => <div key={prompt} className="flex items-start gap-2 rounded-lg border p-2.5"><p className="flex-1 text-sm">“{prompt}”</p><Button type="button" size="icon-sm" variant="ghost" aria-label="Copiar pergunta" onClick={() => void navigator.clipboard.writeText(prompt).then(() => toast.success("Pergunta copiada"))}><CopyIcon /></Button></div>)}</div></div><div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"><h3 className="text-sm font-medium">O que ainda não funciona</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{integration.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div><Button asChild className="w-full"><Link href={`/?prompt=${encodeURIComponent(integration.examplePrompts[0])}`}><MessageCircleIcon />Testar uma pergunta no chat</Link></Button></div>}
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
  return <>
    <Card className="mb-5 border-primary/30 bg-primary/5"><CardHeader><CardTitle>Como usar no chat — sem comandos</CardTitle><CardDescription>Você não precisa escrever “chamar integração” nem escolher uma ferramenta.</CardDescription></CardHeader><CardContent><ol className="grid gap-3 text-sm sm:grid-cols-3"><li className="rounded-lg bg-background p-3"><strong className="block">1. Conecte sua conta</strong><span className="text-muted-foreground">Use o botão da plataforma abaixo.</span></li><li className="rounded-lg bg-background p-3"><strong className="block">2. Escreva normalmente</strong><span className="text-muted-foreground">Ex.: “Quais reuniões tenho hoje?”</span></li><li className="rounded-lg bg-background p-3"><strong className="block">3. O agente consulta</strong><span className="text-muted-foreground">Um aviso aparece enquanto a plataforma é consultada.</span></li></ol></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{integrations.map((item) => <Card key={item.id} className="overflow-hidden"><div className="h-1" style={{ backgroundColor: item.color }} /><CardHeader><div className="flex items-start justify-between gap-2"><div><CardTitle>{item.name}</CardTitle><CardDescription>{item.description}</CardDescription></div><Badge variant={item.connected ? "default" : "outline"}>{item.connected ? "Conectada" : "Disponível"}</Badge></div></CardHeader><CardContent className="space-y-4"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Você pode</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{item.capabilities.slice(0, 3).map((capability) => <li key={capability}>{capability}</li>)}</ul></div><div className="rounded-lg bg-secondary/50 p-3 text-sm"><span className="block text-xs font-medium text-muted-foreground">Exemplo no chat</span>“{item.examplePrompts[0]}”</div>{item.connected && <div className="text-sm"><p className="font-medium">{item.accountLabel}</p>{item.lastUsedAt && <p className="text-xs text-muted-foreground">Último uso: {new Date(item.lastUsedAt).toLocaleString("pt-BR")}</p>}{item.lastError && <p className="mt-1 text-xs text-destructive">{item.lastError}</p>}</div>}<div className="flex flex-wrap gap-2"><Button className="flex-1" variant={item.connected ? "outline" : "default"} onClick={() => setSelected(item)}><PlugIcon />{item.connected ? "Ver exemplos" : "Conectar passo a passo"}</Button>{item.connected && <Button asChild className="flex-1"><Link href={`/?prompt=${encodeURIComponent(item.examplePrompts[0])}`}><MessageCircleIcon />Usar no chat</Link></Button>}{item.connected && <Button size="icon" variant="ghost" aria-label={`Desconectar ${item.name}`} onClick={() => void disconnect(item)}><UnplugIcon /></Button>}</div></CardContent></Card>)}</div>
    {integrations.length === 0 && <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma integração foi liberada para seu usuário. Solicite ao administrador que libere a plataforma desejada.</CardContent></Card>}
    {selected && <Wizard integration={selected} open onOpenChange={(open) => { if (!open) setSelected(null); }} onChanged={refresh} />}
  </>;
}

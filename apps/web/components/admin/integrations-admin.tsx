"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IntegrationProvider } from "@/lib/integrations/catalog";

type IntegrationAdmin = {
  id: IntegrationProvider; name: string; description: string; authType: "oauth" | "token"; color: string;
  setupSteps: string[]; docsUrl: string; active: boolean; clientId: string; secretConfigured: boolean; userIds: string[];
};
type UserOption = { id: string; name: string; email: string; active: boolean };

function IntegrationCard({ integration, users, appUrl }: { integration: IntegrationAdmin; users: UserOption[]; appUrl: string }) {
  const [active, setActive] = useState(integration.active);
  const [clientId, setClientId] = useState(integration.clientId);
  const [clientSecret, setClientSecret] = useState("");
  const [userIds, setUserIds] = useState(integration.userIds);
  const [saving, setSaving] = useState(false);
  const callback = `${appUrl}/api/integrations/oauth/callback/${integration.id}`;

  async function save() {
    setSaving(true);
    const response = await fetch(`/api/admin/integrations/${integration.id}`, { method: "PATCH", body: JSON.stringify({ active, clientId, clientSecret, userIds }) });
    setSaving(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao salvar integração");
    setClientSecret("");
    toast.success(`${integration.name} atualizado`);
  }

  return (
    <Card className="overflow-hidden">
      <div className="h-1" style={{ backgroundColor: integration.color }} />
      <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{integration.name}</CardTitle><CardDescription>{integration.description}</CardDescription></div><Badge variant={active ? "default" : "outline"}>{active ? "Ativa" : "Inativa"}</Badge></div></CardHeader>
      <CardContent className="space-y-5">
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3"><span><span className="block text-sm font-medium">Disponível na plataforma</span><span className="text-xs text-muted-foreground">Somente usuários liberados poderão conectar.</span></span><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /></label>
        {integration.authType === "oauth" && <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1"><Label htmlFor={`client-${integration.id}`}>Client ID</Label><Input id={`client-${integration.id}`} value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" /></div>
          <div className="space-y-1"><Label htmlFor={`secret-${integration.id}`}>Client Secret</Label><Input id={`secret-${integration.id}`} type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder={integration.secretConfigured ? "Configurado — preencha apenas para substituir" : "Obrigatório para ativar"} autoComplete="new-password" /></div>
          <div className="space-y-1"><Label>URL de callback</Label><div className="flex gap-2"><Input readOnly value={callback} /><Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(callback).then(() => toast.success("URL copiada"))}>Copiar</Button></div></div>
        </div>}
        <div className="space-y-2"><div><h3 className="text-sm font-medium">Usuários autorizados</h3><p className="text-xs text-muted-foreground">A conexão e os dados permanecem individuais para cada pessoa.</p></div><div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">{users.map((user) => <label key={user.id} className="flex items-center gap-2 rounded-md border p-2 text-sm"><input type="checkbox" disabled={!user.active} checked={userIds.includes(user.id)} onChange={() => setUserIds((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id])} /><span className="min-w-0"><span className="block truncate">{user.name}</span><span className="block truncate text-xs text-muted-foreground">{user.email}{!user.active ? " — inativo" : ""}</span></span></label>)}</div></div>
        <details className="text-sm"><summary className="cursor-pointer font-medium">Passo a passo de configuração</summary><ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">{integration.setupSteps.map((step) => <li key={step}>{step}</li>)}</ol><a className="mt-2 inline-block text-primary hover:underline" href={integration.docsUrl} target="_blank" rel="noreferrer">Abrir documentação oficial</a></details>
        <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving}>{saving ? "Salvando..." : "Salvar integração"}</Button></div>
      </CardContent>
    </Card>
  );
}

export function IntegrationsAdmin({ integrations, users, appUrl }: { integrations: IntegrationAdmin[]; users: UserOption[]; appUrl: string }) {
  return <div className="grid gap-5 xl:grid-cols-2">{integrations.map((integration) => <IntegrationCard key={integration.id} integration={integration} users={users} appUrl={appUrl} />)}</div>;
}

import { getAdminHealth } from "@/lib/services/health";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TriangleAlert } from "lucide-react";
import { RefreshButton } from "@/components/admin/refresh-button";

export const dynamic = "force-dynamic";

function fmtBytes(value?: number) {
  if (value == null) return "—";
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function Status({ value }: { value: "ok" | "warning" | "error" }) {
  return <Badge variant={value === "ok" ? "default" : value === "error" ? "destructive" : "secondary"}>{value === "ok" ? "Saudável" : value === "error" ? "Erro" : "Atenção"}</Badge>;
}

export default async function HealthPage() {
  const health = await getAdminHealth();
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-heading text-xl font-medium">Saúde do sistema</h1><p className="text-sm text-muted-foreground">Diagnóstico atualizado em {health.checkedAt.toLocaleString("pt-BR")} — nenhum segredo é exibido.</p></div><RefreshButton label="Executar diagnóstico" /></div>
      {health.unavailable.length > 0 && <Card className="border-amber-500/40 bg-amber-500/5"><CardHeader><div className="flex items-start gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" /><div><CardTitle className="text-sm">Diagnóstico parcialmente disponível</CardTitle><CardDescription>Não foi possível consultar: {health.unavailable.join(", ")}.</CardDescription></div></div></CardHeader></Card>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Banco de dados</CardTitle><Status value={health.database.status} /></div><CardDescription>{health.database.message}</CardDescription></CardHeader><CardContent>{health.database.durationMs ?? 0} ms</CardContent></Card>
        <Card><CardHeader><div className="flex items-center justify-between gap-2"><CardTitle>Estrutura do banco</CardTitle><Status value={health.schema.status} /></div><CardDescription>{health.schema.message}</CardDescription></CardHeader><CardContent>{health.schema.missing.length > 0 ? <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{health.schema.missing.map((item) => <li key={item}>{item}</li>)}</ul> : `${health.schema.durationMs ?? 0} ms`}</CardContent></Card>
        <Card><CardHeader><div className="flex items-center justify-between"><CardTitle>OpenAI</CardTitle><Status value={health.openai.status} /></div><CardDescription>{health.openai.message}</CardDescription></CardHeader><CardContent>Chave: {health.configured.hasOpenAiKey ? "configurada" : "não identificada"}<br />Modelo padrão: {health.configured.defaultModel}<br />Verificação: {health.openai.durationMs ?? 0} ms</CardContent></Card>
        <Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Armazenamento</CardTitle><Status value={health.storage.status} /></div><CardDescription>{health.storage.message}</CardDescription></CardHeader><CardContent>{health.storage.usedPercent?.toFixed(1) ?? "—"}% usado<br />{fmtBytes(health.storage.freeBytes)} livres de {fmtBytes(health.storage.totalBytes)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Processamento de documentos</CardTitle><CardDescription>Fila e erros atuais</CardDescription></CardHeader><CardContent>{health.jobs.pending} pendente(s)<br />{health.jobs.errors} com erro</CardContent></Card>
        <Card><CardHeader><CardTitle>Uso nas últimas 24 horas</CardTitle><CardDescription>Chamadas de chat e embeddings</CardDescription></CardHeader><CardContent>{health.usage.calls} chamada(s)<br />{health.usage.tokens.toLocaleString("pt-BR")} tokens<br />{health.usage.failures} falha(s)</CardContent></Card>
        <Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Versão</CardTitle><Status value={health.update.status} /></div><CardDescription>{health.update.message}</CardDescription></CardHeader><CardContent>Instalada: {health.update.currentVersion}<br />Mais recente: {health.update.latestVersion ?? "não identificada"}</CardContent></Card>
      </div>
      <p className="text-xs text-muted-foreground">Use “Executar diagnóstico” para repetir as verificações. A consulta à OpenAI possui timeout de cinco segundos.</p>
    </main>
  );
}

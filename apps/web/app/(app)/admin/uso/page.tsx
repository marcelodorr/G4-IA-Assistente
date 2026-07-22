import { db } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { getUsageDashboard } from "@/lib/services/usage";
import { UsageQuotaTable } from "@/components/admin/usage-quota-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  let data: Awaited<ReturnType<typeof getUsageDashboard>>;
  let settings: Awaited<ReturnType<typeof getSettings>>;
  try {
    [data, settings] = await Promise.all([getUsageDashboard(db), getSettings(db)]);
  } catch (error) {
    console.error("[admin/uso] Falha ao carregar o painel de uso", error);
    return (
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div><h1 className="font-heading text-xl font-medium">Uso de IA</h1><p className="text-sm text-muted-foreground">Consumo do mês atual, custos estimados e cotas por usuário.</p></div>
        <Card>
          <CardHeader><CardTitle>Não foi possível carregar os dados de uso</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>A aplicação continua disponível, mas a consulta de métricas falhou.</p>
            <p>Confirme no log do Dokploy se as migrations foram concluídas e depois atualize esta página.</p>
          </CardContent>
        </Card>
      </main>
    );
  }
  const usage = data;
  const totalTokens = Number(usage.totals.inputTokens) + Number(usage.totals.outputTokens);
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div><h1 className="font-heading text-xl font-medium">Uso de IA</h1><p className="text-sm text-muted-foreground">Consumo do mês atual, custos estimados e cotas por usuário.</p></div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Tokens</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{totalTokens.toLocaleString("pt-BR")}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Chamadas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(usage.totals.calls).toLocaleString("pt-BR")}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Falhas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{Number(usage.totals.failures).toLocaleString("pt-BR")}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Custo estimado</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">US$ {(Number(usage.totals.costMicros) / 1_000_000).toFixed(4)}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Consumo e cotas por usuário</CardTitle></CardHeader><CardContent className="overflow-x-auto"><UsageQuotaTable rows={usage.byUser} globalDaily={settings.dailyTokenLimit} globalMonthly={settings.monthlyTokenLimit} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Conversas com maior consumo</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Conversa</TableHead><TableHead>Usuário</TableHead><TableHead>Tokens</TableHead><TableHead>Custo estimado</TableHead></TableRow></TableHeader><TableBody>{usage.byConversation.map((row) => <TableRow key={row.id}><TableCell>{row.title}</TableCell><TableCell>{row.userName}</TableCell><TableCell>{Number(row.tokens).toLocaleString("pt-BR")}</TableCell><TableCell>US$ {(Number(row.costMicros) / 1_000_000).toFixed(4)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <p className="text-xs text-muted-foreground">Custos são estimativas baseadas na tabela pública de preços configurada no código; cache, lotes e alterações de preço podem mudar o valor real.</p>
    </main>
  );
}

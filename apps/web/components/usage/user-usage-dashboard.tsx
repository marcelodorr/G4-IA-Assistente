"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { getUserUsageSummary } from "@/lib/services/usage";

type Usage = Awaited<ReturnType<typeof getUserUsageSummary>>;
type Period = Usage["periods"]["daily"];

const tokenFormatter = new Intl.NumberFormat("pt-BR");
const periodLabels = { daily: "Diário", weekly: "Semanal", monthly: "Mensal" } as const;
const operationLabels = { chat: "Resposta do chat", embedding: "Leitura de contexto", image: "Geração de imagem", artifact: "Geração de arquivo" } as const;

function QuotaCard({ label, period }: { label: string; period: Period }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2"><CardTitle className="text-base">{label}</CardTitle>{period.customized && <Badge variant="outline">Limite individual</Badge>}</div>
        <CardDescription>Renova em {new Date(period.resetAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div><span className="text-2xl font-semibold">{tokenFormatter.format(period.remaining)}</span><span className="ml-1 text-sm text-muted-foreground">disponíveis</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-label={`${period.percentage}% utilizado`}><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${period.percentage}%` }} /></div>
        <div className="flex justify-between text-xs text-muted-foreground"><span>{tokenFormatter.format(period.used)} usados</span><span>limite {tokenFormatter.format(period.limit)}</span></div>
      </CardContent>
    </Card>
  );
}

export function UserUsageDashboard({ initialUsage }: { initialUsage: Usage }) {
  const [usage, setUsage] = useState(initialUsage);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/usage/me", { cache: "no-store" });
      if (response.ok) setUsage(await response.json() as Usage);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const onUsageUpdated = () => void refresh();
    window.addEventListener("sequor:usage-updated", onUsageUpdated);
    const timer = window.setInterval(refresh, 5_000);
    return () => {
      window.removeEventListener("sequor:usage-updated", onUsageUpdated);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return (
    <div className="space-y-6">
      {usage.unavailable.length > 0 && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">Dados parciais: não foi possível consultar {usage.unavailable.join(", ")}. As demais informações continuam atualizando normalmente.</div>}
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(periodLabels) as Array<keyof typeof periodLabels>).map((key) => <QuotaCard key={key} label={periodLabels[key]} period={usage.periods[key]} />)}
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><CardTitle>Tokens por interação</CardTitle><CardDescription>Atualização automática a cada 5 segundos. Entrada + saída representam o gasto exato após a conclusão.</CardDescription></div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-emerald-500" />{refreshing ? "Atualizando…" : `Atualizado às ${new Date(usage.updatedAt).toLocaleTimeString("pt-BR")}`}</div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Operação</TableHead><TableHead>Conversa</TableHead><TableHead>Entrada</TableHead><TableHead>Saída</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {usage.interactions.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="whitespace-nowrap">{operationLabels[item.kind]}</TableCell>
                  <TableCell className="max-w-56 truncate">{item.conversationId ? <Link className="hover:text-primary hover:underline" href={`/c/${item.conversationId}`}>{item.conversationTitle}</Link> : "—"}</TableCell>
                  <TableCell>{item.processing ? "—" : tokenFormatter.format(item.inputTokens)}</TableCell>
                  <TableCell>{item.processing ? "—" : tokenFormatter.format(item.outputTokens)}</TableCell>
                  <TableCell className="font-medium">{item.processing ? `até ${tokenFormatter.format(item.tokens)}` : tokenFormatter.format(item.tokens)}</TableCell>
                  <TableCell><Badge variant={item.processing ? "outline" : item.success === false ? "destructive" : "default"}>{item.processing ? "Em andamento" : item.success === false ? "Falhou" : "Concluída"}</Badge></TableCell>
                </TableRow>
              ))}
              {usage.interactions.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Você ainda não consumiu tokens.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Enquanto uma resposta está sendo gerada, o sistema exibe a reserva máxima de tokens. Assim que ela termina, a reserva é substituída pelo valor exato realmente utilizado.</p>
    </div>
  );
}

"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = {
  id: string; name: string; email: string; todayTokens: number; weekTokens: number; monthTokens: number;
  costMicros: number; dailyTokenLimit: number | null; weeklyTokenLimit: number | null; monthlyTokenLimit: number | null;
};

export function UsageQuotaTable({ rows, globalDaily, globalWeekly, globalMonthly }: { rows: Row[]; globalDaily: number; globalWeekly: number; globalMonthly: number }) {
  const [drafts, setDrafts] = useState(() => Object.fromEntries(rows.map((row) => [row.id, {
    daily: String(row.dailyTokenLimit ?? ""), weekly: String(row.weeklyTokenLimit ?? ""), monthly: String(row.monthlyTokenLimit ?? ""),
  }])));
  const [saving, setSaving] = useState<string | null>(null);

  async function save(id: string) {
    setSaving(id);
    const draft = drafts[id];
    const res = await fetch(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({
      dailyTokenLimit: draft.daily ? Number(draft.daily) : null,
      weeklyTokenLimit: draft.weekly ? Number(draft.weekly) : null,
      monthlyTokenLimit: draft.monthly ? Number(draft.monthly) : null,
    }) });
    setSaving(null);
    if (!res.ok) return toast.error((await res.json()).error ?? "Erro ao salvar cotas");
    toast.success("Cotas do usuário salvas");
  }

  return (
    <Table>
      <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Hoje</TableHead><TableHead>Semana</TableHead><TableHead>Mês</TableHead><TableHead>Custo estimado</TableHead><TableHead>Cota diária</TableHead><TableHead>Cota semanal</TableHead><TableHead>Cota mensal</TableHead><TableHead /></TableRow></TableHeader>
      <TableBody>{rows.map((row) => (
        <TableRow key={row.id}>
          <TableCell><div className="font-medium">{row.name}</div><div className="text-xs text-muted-foreground">{row.email}</div></TableCell>
          <TableCell>{Number(row.todayTokens).toLocaleString("pt-BR")}</TableCell>
          <TableCell>{Number(row.weekTokens).toLocaleString("pt-BR")}</TableCell>
          <TableCell>{Number(row.monthTokens).toLocaleString("pt-BR")}</TableCell>
          <TableCell>US$ {(Number(row.costMicros) / 1_000_000).toFixed(4)}</TableCell>
          <TableCell><Input className="w-28" type="number" min={1000} placeholder={String(globalDaily)} value={drafts[row.id]?.daily ?? ""} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...drafts[row.id], daily: e.target.value } })} /></TableCell>
          <TableCell><Input className="w-28" type="number" min={1000} placeholder={String(globalWeekly)} value={drafts[row.id]?.weekly ?? ""} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...drafts[row.id], weekly: e.target.value } })} /></TableCell>
          <TableCell><Input className="w-32" type="number" min={1000} placeholder={String(globalMonthly)} value={drafts[row.id]?.monthly ?? ""} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...drafts[row.id], monthly: e.target.value } })} /></TableCell>
          <TableCell><Button size="sm" variant="outline" disabled={saving === row.id} onClick={() => save(row.id)}>Salvar</Button></TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
  );
}

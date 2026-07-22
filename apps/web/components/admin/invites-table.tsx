"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listInvites } from "@/lib/services/invites";

type Invite = Awaited<ReturnType<typeof listInvites>>[number];
type Status = "pending" | "expired" | "used" | "revoked";

function statusOf(invite: Invite): Status {
  if (invite.revokedAt) return "revoked";
  if (invite.usedAt) return "used";
  if (new Date(invite.expiresAt) <= new Date()) return "expired";
  return "pending";
}

const LABELS: Record<Status, string> = { pending: "Pendente", expired: "Expirado", used: "Utilizado", revoked: "Revogado" };

export function InvitesTable({ invites }: { invites: Invite[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Status | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const rows = useMemo(() => invites.filter((invite) => filter === "all" || statusOf(invite) === filter), [invites, filter]);

  async function copy(invite: Invite) {
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.token}`);
    toast.success("Link copiado");
  }
  async function revoke(id: string) {
    setBusy(id);
    const res = await fetch(`/api/invites/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return toast.error((await res.json()).error ?? "Erro ao revogar convite");
    toast.success("Convite revogado"); router.refresh();
  }
  async function renew(id: string) {
    setBusy(id);
    const res = await fetch(`/api/invites/${id}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(body.error ?? "Erro ao renovar convite");
    await navigator.clipboard.writeText(body.url);
    toast.success("Novo convite criado e copiado"); router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3"><h2 className="font-heading text-base font-medium">Convites</h2><Select value={filter} onValueChange={(v) => setFilter(v as Status | "all")}><SelectTrigger className="w-40" aria-label="Filtrar convites"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pendentes</SelectItem><SelectItem value="expired">Expirados</SelectItem><SelectItem value="used">Utilizados</SelectItem><SelectItem value="revoked">Revogados</SelectItem><SelectItem value="all">Todos</SelectItem></SelectContent></Select></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>E-mail</TableHead><TableHead>Papel</TableHead><TableHead>Expira em</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map((invite) => { const status = statusOf(invite); return <TableRow key={invite.id}><TableCell>{invite.email}</TableCell><TableCell>{invite.role === "admin" ? "Administrador" : "Membro"}</TableCell><TableCell>{new Date(invite.expiresAt).toLocaleString("pt-BR")}</TableCell><TableCell><Badge variant={status === "pending" ? "default" : "outline"}>{LABELS[status]}</Badge></TableCell><TableCell className="space-x-1 text-right">{status === "pending" && <><Button size="sm" variant="outline" onClick={() => copy(invite)}>Copiar</Button><Button size="sm" variant="destructive" disabled={busy === invite.id} onClick={() => revoke(invite.id)}>Revogar</Button></>}{(status === "expired" || status === "revoked") && <Button size="sm" variant="outline" disabled={busy === invite.id} onClick={() => renew(invite.id)}>Renovar e copiar</Button>}</TableCell></TableRow>; })}{rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum convite neste filtro.</TableCell></TableRow>}</TableBody></Table></div>
    </div>
  );
}

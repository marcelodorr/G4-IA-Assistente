"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listUsers } from "@/lib/services/users";

type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

export function UsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function update(user: UserRow, body: Record<string, unknown>, success: string) {
    setBusy(user.id);
    const res = await fetch(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) return toast.error((await res.json()).error ?? "Erro ao atualizar usuário");
    toast.success(success); router.refresh();
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Papel</TableHead><TableHead>Status</TableHead><TableHead>Último acesso</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell><div className="font-medium">{user.name}</div><div className="text-xs text-muted-foreground">{user.email}</div></TableCell>
              <TableCell><Select value={user.role} disabled={busy === user.id} onValueChange={(role) => update(user, { role }, "Papel atualizado; sessões anteriores foram encerradas")}><SelectTrigger className="w-36" aria-label={`Papel de ${user.name}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="member">Membro</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></TableCell>
              <TableCell><Badge variant={user.active ? "default" : "destructive"}>{user.active ? "Ativo" : "Inativo"}</Badge></TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("pt-BR") : "Nunca entrou"}</TableCell>
              <TableCell><div className="flex gap-1"><Button variant="outline" size="sm" disabled={busy === user.id} onClick={() => update(user, { active: !user.active }, user.active ? "Usuário desativado" : "Usuário ativado")}>{user.active ? "Desativar" : "Ativar"}</Button><Button variant="ghost" size="sm" disabled={busy === user.id} onClick={() => update(user, { revokeSessions: true }, "Sessões encerradas")}>Encerrar sessões</Button></div></TableCell>
            </TableRow>
          ))}
          {users.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum usuário cadastrado.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { listUsers } from "@/lib/services/users";

type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

export function UsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [carregandoId, setCarregandoId] = useState<string | null>(null);

  async function alternarAtivo(user: UserRow) {
    setCarregandoId(user.id);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !user.active }),
    });
    setCarregandoId(null);
    if (!res.ok) {
      toast.error((await res.json()).error ?? "Erro ao atualizar usuário");
      return;
    }
    router.refresh();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell className="text-muted-foreground">{user.email}</TableCell>
            <TableCell>
              <Badge variant={user.role === "admin" ? "secondary" : "outline"}>
                {user.role === "admin" ? "Administrador" : "Membro"}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={user.active ? "default" : "destructive"}>
                {user.active ? "Ativo" : "Inativo"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                disabled={carregandoId === user.id}
                onClick={() => alternarAtivo(user)}
              >
                {user.active ? "Desativar" : "Ativar"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {users.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              Nenhum usuário cadastrado.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

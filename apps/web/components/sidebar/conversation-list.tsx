"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { listConversations } from "@/lib/services/conversations";

type ConversationRow = Awaited<ReturnType<typeof listConversations>>[number];

export function ConversationList({
  conversations,
  user,
}: {
  conversations: ConversationRow[];
  user: Session["user"];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  const filtradas = conversations.filter((conv) =>
    (conv.title ?? "Nova conversa").toLowerCase().includes(busca.toLowerCase())
  );

  async function excluir(id: string) {
    setExcluindoId(id);
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setExcluindoId(null);
    if (!res.ok) return;
    const eraAtiva = pathname === `/c/${id}`;
    router.refresh();
    if (eraAtiva) router.push("/");
  }

  async function sair() {
    setSaindo(true);
    try {
      // O redirecionamento calculado pelo Auth.js pode usar o host interno
      // quando a aplicação está atrás do proxy do Dokploy. Encerramos a
      // sessão sem redirect e navegamos por uma URL relativa à origem atual.
      await signOut({ redirect: false });
      window.location.assign("/login");
    } catch {
      setSaindo(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-3 pb-2">
        <Input
          value={busca}
          aria-label="Buscar conversas"
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar conversas..."
        />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
        {filtradas.map((conv) => {
          const href = `/c/${conv.id}`;
          const ativa = pathname === href;
          return (
            <div key={conv.id} className="group/conversation relative">
              <Link
                href={href}
                className={cn(
                  "block truncate rounded-lg px-2.5 py-1.5 pr-7 text-sm transition-colors",
                  ativa
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {conv.title || "Nova conversa"}
              </Link>
              <button
                type="button"
                onClick={() => excluir(conv.id)}
                disabled={excluindoId === conv.id}
                aria-label="Excluir conversa"
                className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-destructive focus:block group-hover/conversation:block group-focus-within/conversation:block"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
        {filtradas.length === 0 && (
          <p className="px-2.5 py-2 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
        )}
      </nav>
      <div className="space-y-2 border-t p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <Link href="/integracoes" className="mr-3 text-xs text-muted-foreground hover:text-foreground">Integrações</Link>
          {user.role === "admin" && (
            <Link
              href="/admin/usuarios"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Administração
            </Link>
          )}
        </div>
        <Button variant="outline" size="sm" className="w-full" disabled={saindo} onClick={() => void sair()}>
          {saindo ? "Saindo…" : "Sair"}
        </Button>
      </div>
    </div>
  );
}

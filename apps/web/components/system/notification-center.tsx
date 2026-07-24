"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CircleAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  userName: string | null;
  userEmail: string | null;
  source: string;
  path: string | null;
  title: string;
  message: string;
  suggestion: string;
  code: string;
  severity: "warning" | "error";
  technicalDetails: string | null;
  createdAt: string;
  read: boolean;
};

export function NotificationCenter() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json() as { notifications: Notification[]; unread: number };
      setItems(body.notifications);
      setUnread(body.unread);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    const refresh = () => void load();
    window.addEventListener("sequor:notification-created", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("sequor:notification-created", refresh);
    };
  }, [load]);

  async function opened(open: boolean) {
    if (!open || unread === 0) return;
    setUnread(0);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
  }

  return (
    <DropdownMenu onOpenChange={(open) => void opened(open)}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative" aria-label={unread > 0 ? `${unread} erro(s) não lido(s)` : "Notificações do sistema"}>
          <Bell />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))] overflow-hidden p-0">
        <div className="border-b px-4 py-3"><p className="font-medium">Notificações e erros</p><p className="text-xs text-muted-foreground">O que aconteceu e como resolver, em linguagem simples.</p></div>
        <div className="max-h-[min(32rem,70dvh)] overflow-y-auto">
          {loading && <p className="p-5 text-center text-sm text-muted-foreground">Carregando…</p>}
          {!loading && items.length === 0 && <div className="p-6 text-center"><Bell className="mx-auto mb-2 size-5 text-primary" /><p className="text-sm font-medium">Tudo certo por aqui</p><p className="text-xs text-muted-foreground">Nenhum erro foi registrado.</p></div>}
          {items.map((item) => <article key={item.id} className={`border-b p-4 last:border-0 ${item.read ? "" : "bg-primary/5"}`}>
            <div className="flex items-start gap-2">
              {item.severity === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-1"><h3 className="text-sm font-medium">{item.title}</h3><time className="text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString("pt-BR")}</time></div>
                <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
                <div className="mt-2 rounded-md bg-secondary/50 p-2 text-xs"><strong>O que fazer:</strong> {item.suggestion}</div>
                <p className="mt-2 text-[10px] text-muted-foreground">Origem: {item.source}{item.path ? ` · ${item.path}` : ""} · Código {item.code}{item.userName ? ` · Usuário: ${item.userName}${item.userEmail ? ` (${item.userEmail})` : ""}` : ""}</p>
                {item.technicalDetails && <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted-foreground hover:text-foreground">Detalhes técnicos para o administrador</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 font-mono text-[10px]">{item.technicalDetails}</pre></details>}
              </div>
            </div>
          </article>)}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

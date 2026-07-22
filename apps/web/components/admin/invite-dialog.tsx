"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function InviteDialog() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function resetar(novoAberto: boolean) {
    setAberto(novoAberto);
    if (!novoAberto) {
      setEmail(""); setRole("member"); setUrl(null); setErro(null);
    }
  }

  async function enviarConvite() {
    setEnviando(true); setErro(null);
    const res = await fetch("/api/invites", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
    const body = await res.json();
    setEnviando(false);
    if (!res.ok) { setErro(body.error ?? "Erro ao criar convite"); return; }
    setUrl(body.url);
    router.refresh();
  }

  async function copiarLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  return (
    <Dialog open={aberto} onOpenChange={resetar}>
      <DialogTrigger asChild>
        <Button>Convidar usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>O convite expira em 7 dias e pode ser usado uma única vez.</DialogDescription>
        </DialogHeader>
        {url ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Envie este link para o convidado:</p>
            <div className="flex gap-2">
              <Input readOnly value={url} />
              <Button type="button" variant="outline" onClick={copiarLink}>Copiar link</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
            <Button
              className="w-full"
              disabled={!email.includes("@") || enviando}
              onClick={enviarConvite}
            >
              {enviando ? "Gerando..." : "Gerar convite"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

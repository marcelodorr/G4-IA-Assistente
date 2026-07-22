"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCarregando(true); setErro(null);
    const data = new FormData(e.currentTarget);
    const name = data.get("name") as string;
    const password = data.get("password") as string;
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      body: JSON.stringify({ token, name, password }),
    });
    if (!res.ok) {
      setErro((await res.json()).error ?? "Erro ao aceitar convite");
      setCarregando(false);
      return;
    }
    const login = await signIn("credentials", { email, password, redirect: false });
    if (login?.error) {
      setErro("Conta ativada, mas não foi possível entrar automaticamente. Acesse pela tela de login.");
      setCarregando(false);
      return;
    }
    window.location.replace("/");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Seu nome</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha (mín. 8 caracteres)</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" className="w-full" disabled={carregando}>
        {carregando ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}

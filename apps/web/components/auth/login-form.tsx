"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCarregando(true); setErro(null);
    const data = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: data.get("email"), password: data.get("password"), redirect: false,
    });
    setCarregando(false);
    if (res?.error) setErro("E-mail ou senha incorretos.");
    else { router.push("/"); router.refresh(); }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" className="w-full" disabled={carregando}>
        {carregando ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}

"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { SUPPORTED_MODELS, DEFAULT_MODEL } from "@/lib/ai/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/brand/logo";

export function SetupWizard() {
  const [passo, setPasso] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "", openaiKey: "", defaultModel: DEFAULT_MODEL });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function concluir() {
    setEnviando(true); setErro(null);
    const res = await fetch("/api/setup", { method: "POST", body: JSON.stringify(form) });
    if (!res.ok) {
      setErro((await res.json()).error ?? "Erro ao configurar");
      setEnviando(false);
      return;
    }
    const login = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (login?.error) {
      setErro("Conta criada, mas não foi possível entrar automaticamente. Acesse pela tela de login.");
      setEnviando(false);
      return;
    }

    // Mantém o domínio e o protocolo públicos atuais, inclusive atrás do proxy
    // do Dokploy, sem depender de uma URL absoluta calculada pelo Auth.js.
    window.location.replace("/");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center space-y-3">
        <Logo />
        <p className="text-sm text-muted-foreground">Configuração inicial — passo {passo} de 3</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {passo === 1 && (<>
          <div className="space-y-2"><Label>Seu nome</Label><Input value={form.name} onChange={set("name")} /></div>
          <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={set("email")} /></div>
          <div className="space-y-2"><Label>Senha (mín. 8 caracteres)</Label><Input type="password" value={form.password} onChange={set("password")} /></div>
          <Button className="w-full" disabled={!form.name || !form.email || form.password.length < 8} onClick={() => setPasso(2)}>Continuar</Button>
        </>)}
        {passo === 2 && (<>
          <div className="space-y-2">
            <Label>Chave da OpenAI</Label>
            <Input type="password" placeholder="sk-..." value={form.openaiKey} onChange={set("openaiKey")} />
            <p className="text-xs text-muted-foreground">Crie em platform.openai.com/api-keys. A chave fica criptografada no seu banco.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPasso(1)}>Voltar</Button>
            <Button className="flex-1" disabled={!form.openaiKey.startsWith("sk-")} onClick={() => setPasso(3)}>Continuar</Button>
          </div>
        </>)}
        {passo === 3 && (<>
          <div className="space-y-2">
            <Label>Modelo padrão</Label>
            <Select value={form.defaultModel} onValueChange={(v) => setForm({ ...form, defaultModel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SUPPORTED_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPasso(2)}>Voltar</Button>
            <Button className="flex-1" disabled={enviando} onClick={concluir}>{enviando ? "Configurando..." : "Concluir"}</Button>
          </div>
        </>)}
      </CardContent>
    </Card>
  );
}

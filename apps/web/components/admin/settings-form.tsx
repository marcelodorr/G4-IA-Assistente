"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SUPPORTED_MODELS } from "@/lib/ai/models";

export function SettingsForm({ defaultModel, hasKey }: { defaultModel: string; hasKey: boolean }) {
  const [openaiKey, setOpenaiKey] = useState("");
  const [modelo, setModelo] = useState(defaultModel);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ openaiKey: openaiKey.trim() || undefined, defaultModel: modelo }),
    });
    setSalvando(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao salvar configurações");
      return;
    }
    setOpenaiKey("");
    toast.success("Configurações salvas");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>OpenAI</CardTitle>
        <CardDescription>
          {hasKey ? "Uma chave já está configurada." : "Nenhuma chave configurada ainda."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-openai-key">Nova chave OpenAI</Label>
          <Input
            id="settings-openai-key"
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-... (deixe em branco para manter)"
          />
        </div>
        <div className="space-y-2">
          <Label>Modelo padrão</Label>
          <Select value={modelo} onValueChange={setModelo}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUPPORTED_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full" disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando..." : "Salvar configurações"}
        </Button>
      </CardContent>
    </Card>
  );
}

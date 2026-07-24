"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { getOwnProfile, Tone, Trait } from "@/lib/services/profile";

type Preferences = Awaited<ReturnType<typeof getOwnProfile>>["preferences"];
const TRAIT_OPTIONS: Array<{ value: Trait; label: string }> = [{ value: "welcoming", label: "Acolhedor" }, { value: "enthusiastic", label: "Entusiasmado" }, { value: "analytical", label: "Analítico" }, { value: "patient", label: "Paciente" }, { value: "objective", label: "Objetivo" }];

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description: string }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-lg border p-3 text-left hover:bg-accent"><span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span><span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted")}><span className={cn("absolute top-1 size-4 rounded-full bg-white transition-transform", checked ? "translate-x-6" : "translate-x-1")} /></span></button>;
}

export function PersonalizationForm({ initial }: { initial: Preferences }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleTrait = (trait: Trait) => set("traits", form.traits.includes(trait) ? form.traits.filter((item) => item !== trait) : [...form.traits, trait]);

  async function save() {
    setSaving(true);
    const response = await fetch("/api/profile/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(body.error ?? "Não foi possível salvar a personalização");
    setForm((current) => ({ ...current, ...body }));
    toast.success("Personalização salva e aplicada aos próximos chats");
  }

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>Como a IA deve responder</CardTitle><CardDescription>Estas preferências valem para conversas avulsas, projetos e assistentes.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label>Estilo e tom básico</Label><Select value={form.tone} onValueChange={(value) => set("tone", value as Tone)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="balanced">Equilibrado</SelectItem><SelectItem value="professional">Profissional</SelectItem><SelectItem value="friendly">Amigável</SelectItem><SelectItem value="direct">Direto</SelectItem><SelectItem value="creative">Criativo</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Características</Label><div className="flex flex-wrap gap-2">{TRAIT_OPTIONS.map((trait) => <Button key={trait.value} type="button" size="sm" variant={form.traits.includes(trait.value) ? "default" : "outline"} onClick={() => toggleTrait(trait.value)}>{trait.label}</Button>)}</div></div><div className="grid gap-3 sm:grid-cols-2"><Toggle checked={form.useHeadings} onChange={(value) => set("useHeadings", value)} label="Listas e cabeçalhos" description="Estrutura respostas longas para facilitar a leitura." /><Toggle checked={form.useEmojis} onChange={(value) => set("useEmojis", value)} label="Emojis" description="Permite emojis usados com moderação." /><Toggle checked={form.conciseResponses} onChange={(value) => set("conciseResponses", value)} label="Respostas rápidas" description="Prioriza respostas mais curtas e diretas." /><Toggle checked={form.suggestedPrompts} onChange={(value) => set("suggestedPrompts", value)} label="Prompts sugeridos" description="Mostra sugestões úteis na nova conversa." /></div><div className="space-y-2"><Label htmlFor="custom-instructions">Instruções personalizadas</Label><Textarea id="custom-instructions" className="min-h-36" maxLength={10_000} value={form.customInstructions} onChange={(event) => set("customInstructions", event.target.value)} placeholder="Ex.: Sempre comece com um resumo executivo e depois detalhe os próximos passos..." /></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Sobre você</CardTitle><CardDescription>Informações usadas como contexto pessoal em todos os seus agentes.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="job-title">Cargo</Label><Input id="job-title" value={form.jobTitle} maxLength={200} onChange={(event) => set("jobTitle", event.target.value)} placeholder="Ex.: Gerente de transformação digital" /></div><div className="space-y-2"><Label htmlFor="about-you">Sobre você</Label><Textarea id="about-you" value={form.aboutYou} maxLength={5_000} onChange={(event) => set("aboutYou", event.target.value)} placeholder="Sua área, responsabilidades e contexto profissional..." /></div><div className="space-y-2"><Label htmlFor="more-about-you">Mais sobre você</Label><Textarea id="more-about-you" value={form.moreAboutYou} maxLength={5_000} onChange={(event) => set("moreAboutYou", event.target.value)} placeholder="Interesses, valores ou preferências que a IA deve considerar..." /></div><div className="grid gap-3 sm:grid-cols-2"><Toggle checked={form.memoryEnabled} onChange={(value) => set("memoryEnabled", value)} label="Memória pessoal" description="Usa estas informações em novas conversas." /><Toggle checked={form.webSearchEnabled} onChange={(value) => set("webSearchEnabled", value)} label="Busca na web" description="Permite consultar informações atuais quando necessário." /></div></CardContent></Card>
    <div className="flex justify-end"><Button size="lg" disabled={saving} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar personalização"}</Button></div>
  </div>;
}

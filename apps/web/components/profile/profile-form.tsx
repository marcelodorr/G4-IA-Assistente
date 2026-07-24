"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Profile = { name: string; email: string; username: string | null; avatarUrl: string | null };

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, username: username || null }) });
    setBusy(false);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(body.error ?? "Não foi possível salvar o perfil");
    toast.success("Perfil atualizado");
    router.refresh();
  }

  async function upload(file: File) {
    setBusy(true);
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/profile/avatar", { method: "POST", body: form });
    setBusy(false);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(body.error ?? "Não foi possível enviar a foto");
    setAvatarUrl(body.avatarUrl);
    toast.success("Foto atualizada");
    router.refresh();
  }

  async function removeAvatar() {
    setBusy(true);
    const response = await fetch("/api/profile/avatar", { method: "DELETE" });
    setBusy(false);
    if (!response.ok) return toast.error("Não foi possível remover a foto");
    setAvatarUrl(null); router.refresh();
  }

  return <Card><CardHeader><CardTitle>Identidade do perfil</CardTitle><CardDescription>Esses dados ajudam a personalizar seus chats e identificam você dentro da plataforma.</CardDescription></CardHeader><CardContent className="space-y-6">
    <div className="flex flex-wrap items-center gap-4"><Avatar className="size-20"><AvatarImage src={avatarUrl ?? undefined} /><AvatarFallback className="text-xl">{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="flex flex-wrap gap-2"><input ref={fileRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} /><Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}><Camera />Alterar foto</Button>{avatarUrl && <Button variant="ghost" disabled={busy} onClick={() => void removeAvatar()}><Trash2 />Remover</Button>}<p className="w-full text-xs text-muted-foreground">JPG, PNG ou WebP, até 5 MB.</p></div></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="display-name">Nome de exibição</Label><Input id="display-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} /></div><div className="space-y-2"><Label htmlFor="username">Nome de usuário</Label><Input id="username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="seu.usuario" maxLength={30} /><p className="text-xs text-muted-foreground">Letras, números, ponto, hífen ou sublinhado.</p></div></div>
    <div className="space-y-2"><Label>E-mail corporativo</Label><Input value={profile.email} disabled /></div>
    <Button disabled={busy || name.trim().length < 2} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar perfil"}</Button>
  </CardContent></Card>;
}

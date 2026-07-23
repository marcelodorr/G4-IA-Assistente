"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProjectRow = { id: string; name: string; description: string | null; context: string; updatedAt: Date | string };

export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [context, setContext] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    const response = await fetch("/api/projects", { method: "POST", body: JSON.stringify({ name, description, context }) });
    setSaving(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao criar projeto");
    const project = await response.json() as { id: string };
    setOpen(false);
    toast.success("Projeto criado");
    router.push(`/projetos/${project.id}`);
    router.refresh();
  }

  return <>
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="font-heading text-xl font-medium">Meus projetos</h1><p className="text-sm text-muted-foreground">Agrupe conversas e mantenha contexto, documentos e skills disponíveis sem repetir instruções.</p></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button>Novo projeto</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Novo projeto</DialogTitle><DialogDescription>O conteúdo ficará privado e disponível somente nas conversas deste projeto.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="project-name">Nome</Label><Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Implantação MES" maxLength={120} /></div><div className="space-y-2"><Label htmlFor="project-description">Descrição</Label><Input id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Objetivo resumido do projeto" maxLength={500} /></div><div className="space-y-2"><Label htmlFor="project-context">Contexto inicial</Label><Textarea id="project-context" value={context} onChange={(event) => setContext(event.target.value)} className="min-h-32" maxLength={30_000} placeholder="Cliente, objetivo, restrições, padrões de resposta e informações que devem permanecer em todos os chats..." /><p className="text-xs text-muted-foreground">Você poderá editar e anexar documentos ou skills depois.</p></div><Button className="w-full" disabled={!name.trim() || saving} onClick={() => void create()}>{saving ? "Criando..." : "Criar projeto"}</Button></div></DialogContent></Dialog>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <Card key={project.id} className="flex h-full flex-col"><CardHeader><CardTitle>{project.name}</CardTitle><CardDescription>{project.description || "Sem descrição"}</CardDescription></CardHeader><CardContent className="mt-auto space-y-3"><p className="text-xs text-muted-foreground">{project.context.trim() ? "Contexto persistente configurado" : "Contexto ainda não configurado"}</p><div className="flex gap-2"><Button asChild variant="outline" className="flex-1"><Link href={`/projetos/${project.id}`}>Configurar</Link></Button><Button asChild className="flex-1"><Link href={`/?project=${project.id}`}>Novo chat</Link></Button></div></CardContent></Card>)}</div>
    {projects.length === 0 && <Card><CardContent className="py-14 text-center text-muted-foreground">Nenhum projeto criado. Crie o primeiro para manter conversas e contexto organizados.</CardContent></Card>}
  </>;
}

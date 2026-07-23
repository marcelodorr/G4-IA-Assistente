"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/files/policy";
import type { ProjectFileKind } from "@/lib/services/projects";

type ProjectRow = { id: string; name: string; description: string | null; context: string };
type ProjectFile = { id: string; filename: string; size: number; kind: ProjectFileKind; status: "pending" | "processing" | "ready" | "error"; error: string | null; stale?: boolean };
const KIND_LABEL: Record<ProjectFileKind, string> = { document: "Documento", context: "Contexto persistente", skill: "Skill / instrução" };

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ProjectEditor({ project, initialFiles }: { project: ProjectRow; initialFiles: ProjectFile[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [context, setContext] = useState(project.context);
  const [files, setFiles] = useState(initialFiles);
  const [kind, setKind] = useState<ProjectFileKind>("document");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);

  async function loadFiles() {
    const response = await fetch(`/api/projects/${project.id}/files`, { cache: "no-store" });
    if (response.ok) setFiles(await response.json());
  }
  useEffect(() => {
    if (!files.some((file) => (file.status === "pending" || file.status === "processing") && !file.stale)) return;
    const timer = setInterval(() => void loadFiles(), 3_000);
    return () => clearInterval(timer);
  });

  async function save() {
    setSaving(true);
    const response = await fetch(`/api/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ name, description, context }) });
    setSaving(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao salvar projeto");
    toast.success("Projeto salvo. O contexto já vale para todos os chats vinculados.");
    router.refresh();
  }

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) return toast.error(`O arquivo deve ter no máximo ${MAX_UPLOAD_LABEL}`);
    setUploading(true);
    const form = new FormData(); form.append("file", file); form.append("kind", kind);
    const response = await fetch(`/api/projects/${project.id}/files`, { method: "POST", body: form });
    setUploading(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao enviar arquivo");
    toast.success(`${KIND_LABEL[kind]} enviado para processamento`);
    await loadFiles();
  }

  async function fileAction(fileId: string, method: "POST" | "DELETE") {
    setBusyFile(fileId);
    const response = await fetch(`/api/projects/${project.id}/files/${fileId}`, { method });
    setBusyFile(null);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao processar arquivo");
    await loadFiles();
  }

  async function removeProject() {
    if (!window.confirm("Excluir este projeto? As conversas serão mantidas, mas deixarão de usar o contexto e os arquivos do projeto.")) return;
    const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Erro ao excluir projeto");
    toast.success("Projeto excluído"); router.push("/projetos"); router.refresh();
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-heading text-xl font-medium">{project.name}</h1><p className="text-sm text-muted-foreground">Tudo aqui é aplicado somente às conversas deste projeto.</p></div><div className="flex gap-2"><Button asChild><Link href={`/?project=${project.id}`}>Nova conversa neste projeto</Link></Button><Button variant="destructive" onClick={() => void removeProject()}>Excluir</Button></div></div>
    <Card><CardHeader><CardTitle>Contexto persistente</CardTitle><CardDescription>Escreva uma vez. Objetivos, cliente, regras e preferências serão enviados automaticamente em todas as conversas do projeto.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="edit-project-name">Nome</Label><Input id="edit-project-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></div><div className="space-y-2"><Label htmlFor="edit-project-description">Descrição</Label><Input id="edit-project-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></div><div className="space-y-2"><Label htmlFor="edit-project-context">Contexto que todo chat deve conhecer</Label><Textarea id="edit-project-context" className="min-h-48" value={context} onChange={(event) => setContext(event.target.value)} maxLength={30_000} placeholder="Ex.: Este projeto atende o cliente X. O objetivo é... Sempre considere... Não utilize..." /><p className="text-xs text-muted-foreground">{context.length.toLocaleString("pt-BR")} / 30.000 caracteres</p></div><Button disabled={!name.trim() || saving} onClick={() => void save()}>{saving ? "Salvando..." : "Salvar contexto"}</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Documentos, contexto e skills</CardTitle><CardDescription>Documentos são pesquisados quando relevantes. Contextos e skills são carregados automaticamente em cada conversa, até o limite seguro de contexto.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row"><Select value={kind} onValueChange={(value) => setKind(value as ProjectFileKind)}><SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="document">Documento para consulta</SelectItem><SelectItem value="context">Contexto persistente</SelectItem><SelectItem value="skill">Skill / instrução</SelectItem></SelectContent></Select><input ref={inputRef} hidden type="file" accept=".md,.jpg,.jpeg,.png,.svg,.xlsx,.xls,.docx,.pptx,.html,.htm,.pdf,.txt,.csv,.json,.yaml,.yml" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} /><Button variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? "Enviando..." : `Adicionar arquivo — até ${MAX_UPLOAD_LABEL}`}</Button></div><div className="space-y-2">{files.map((file) => <div key={file.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.filename}</p><p className="text-xs text-muted-foreground">{KIND_LABEL[file.kind]} · {formatSize(file.size)} · {file.status === "ready" ? "Pronto" : file.status === "error" ? `Erro: ${file.error ?? "falha no processamento"}` : "Processando..."}</p></div>{(file.status === "error" || file.stale) && <Button size="sm" variant="outline" disabled={busyFile === file.id} onClick={() => void fileAction(file.id, "POST")}>Tentar novamente</Button>}<Button size="sm" variant="ghost" disabled={busyFile === file.id} onClick={() => void fileAction(file.id, "DELETE")}>Remover</Button></div>)}{files.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum arquivo anexado.</p>}</div></CardContent></Card>
  </div>;
}

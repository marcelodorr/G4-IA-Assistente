"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2Icon, TriangleAlertIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export type ContextFile = {
  id: string;
  filename: string;
  size: number;
  status: "pending" | "processing" | "ready" | "error";
  error: string | null;
  createdAt: string;
  stale: boolean;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileStatus({ file }: { file: ContextFile }) {
  if (file.stale) return <Badge variant="destructive">Processamento travado</Badge>;
  if (file.status === "ready") return <Badge className="bg-emerald-600">Pronto</Badge>;
  if (file.status === "error") return <Badge variant="destructive" title={file.error ?? undefined}><TriangleAlertIcon className="size-3" />Erro</Badge>;
  return <Badge variant="secondary"><Loader2Icon className="size-3 animate-spin" />{file.status === "pending" ? "Aguardando" : "Processando"}</Badge>;
}

export function GlobalContextForm({ initialContent, initialFiles }: { initialContent: string; initialFiles: ContextFile[] }) {
  const [content, setContent] = useState(initialContent);
  const [files, setFiles] = useState<ContextFile[]>(initialFiles);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const response = await fetch("/api/context/files");
    if (response.ok) setFiles(await response.json());
  }, []);

  useEffect(() => {
    if (!files.some((file) => (file.status === "pending" || file.status === "processing") && !file.stale)) return;
    const timer = setInterval(() => void loadFiles(), 3_000);
    return () => clearInterval(timer);
  }, [files, loadFiles]);

  async function save() {
    setSaving(true);
    const response = await fetch("/api/context", { method: "PATCH", body: JSON.stringify({ content }) });
    setSaving(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao salvar contexto geral");
    toast.success("Contexto geral salvo e já aplicado às novas respostas");
  }

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/context/files", { method: "POST", body: form });
    setUploading(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao enviar arquivo");
    toast.success("Arquivo enviado para processamento");
    await loadFiles();
  }

  async function fileAction(file: ContextFile, method: "POST" | "DELETE") {
    setBusyFile(file.id);
    const response = await fetch(`/api/context/files/${file.id}`, { method });
    setBusyFile(null);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao processar arquivo");
    await loadFiles();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Diretrizes corporativas</CardTitle><CardDescription>Inclua identidade, políticas, terminologia, restrições e regras que devem orientar qualquer resposta.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="global-context">Contexto geral da aplicação</Label>
          <Textarea id="global-context" className="min-h-72" maxLength={50_000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Ex.: A Sequor atua... Sempre considere... Nunca..." />
          <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{content.length.toLocaleString("pt-BR")} / 50.000 caracteres</span><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar diretrizes"}</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documentos, skills e arquivos</CardTitle><CardDescription>Conteúdo indexado na base geral e pesquisado em qualquer conversa quando for relevante.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Aceita PDF, Excel, TXT, Markdown/SKILL.md, CSV, JSON e YAML, até 20 MB.</p>
            <input ref={inputRef} className="hidden" type="file" accept=".pdf,.xlsx,.xls,.txt,.md,.csv,.json,.yaml,.yml" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
            <Button variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? "Enviando..." : "Adicionar arquivo"}</Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Arquivo</TableHead><TableHead>Tamanho</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {files.map((file) => <TableRow key={file.id}>
                  <TableCell className="font-medium">{file.filename}</TableCell><TableCell>{formatSize(file.size)}</TableCell><TableCell><FileStatus file={file} /></TableCell>
                  <TableCell><div className="flex justify-end gap-1">{(file.status === "error" || file.stale) && <Button size="sm" variant="outline" disabled={busyFile === file.id} onClick={() => void fileAction(file, "POST")}>Tentar novamente</Button>}<Button size="icon-sm" variant="ghost" aria-label={`Remover ${file.filename}`} disabled={busyFile === file.id} onClick={() => void fileAction(file, "DELETE")}><XIcon /></Button></div></TableCell>
                </TableRow>)}
                {files.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum arquivo no contexto geral.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

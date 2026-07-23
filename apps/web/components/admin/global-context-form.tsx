"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2Icon, TriangleAlertIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/files/policy";

export type ContextFile = {
  id: string;
  filename: string;
  storagePath: string;
  size: number;
  status: "pending" | "processing" | "ready" | "error";
  error: string | null;
  sourceType: "admin" | "chat_upload";
  sourceUserName: string | null;
  sourceUserEmail: string | null;
  createdAt: string;
  stale: boolean;
};

export type CorporateMemory = {
  id: string;
  content: string;
  status: "pending" | "processing" | "ready" | "error";
  error: string | null;
  conversationId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  sourceType: "chat" | "integration";
  sourceProvider: string | null;
  createdAt: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isExternalSource(value: string) {
  return value.startsWith("https://") || value.startsWith("http://");
}

function FileStatus({ file }: { file: ContextFile }) {
  if (file.stale) return <Badge variant="destructive">Processamento travado</Badge>;
  if (file.status === "ready") return <Badge className="bg-emerald-600">Pronto</Badge>;
  if (file.status === "error") return <Badge variant="destructive" title={file.error ?? undefined}><TriangleAlertIcon className="size-3" />Erro</Badge>;
  return <Badge variant="secondary"><Loader2Icon className="size-3 animate-spin" />{file.status === "pending" ? "Aguardando" : "Processando"}</Badge>;
}

export function GlobalContextForm({ initialContent, initialFiles, initialMemories, initialAutoLearn }: { initialContent: string; initialFiles: ContextFile[]; initialMemories: CorporateMemory[]; initialAutoLearn: boolean }) {
  const [content, setContent] = useState(initialContent);
  const [autoLearn, setAutoLearn] = useState(initialAutoLearn);
  const [files, setFiles] = useState<ContextFile[]>(initialFiles);
  const [memories, setMemories] = useState<CorporateMemory[]>(initialMemories);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingSite, setAddingSite] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const response = await fetch("/api/context/files");
    if (response.ok) setFiles(await response.json());
  }, []);

  const loadMemories = useCallback(async () => {
    const response = await fetch("/api/context/memories");
    if (response.ok) setMemories(await response.json());
  }, []);

  useEffect(() => {
    if (!files.some((file) => (file.status === "pending" || file.status === "processing") && !file.stale)) return;
    const timer = setInterval(() => void loadFiles(), 3_000);
    return () => clearInterval(timer);
  }, [files, loadFiles]);

  async function save() {
    setSaving(true);
    const response = await fetch("/api/context", { method: "PATCH", body: JSON.stringify({ content, autoLearnEnabled: autoLearn }) });
    setSaving(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao salvar contexto geral");
    toast.success("Contexto geral salvo e já aplicado às novas respostas");
  }

  async function memoryAction(memory: CorporateMemory, method: "POST" | "DELETE") {
    setBusyFile(memory.id);
    const response = await fetch(`/api/context/memories/${memory.id}`, { method });
    setBusyFile(null);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao processar memória");
    if (method === "DELETE") setMemories((current) => current.filter((item) => item.id !== memory.id));
    else {
      await loadMemories();
    }
  }

  async function importHistory() {
    setImporting(true);
    const response = await fetch("/api/context/backfill", { method: "POST" });
    setImporting(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao importar histórico");
    const result = await response.json() as { filesQueued: number; memoriesQueued: number; hasMore: boolean };
    toast.success(`${result.filesQueued} arquivo(s) e ${result.memoriesQueued} memória(s) enviados para processamento${result.hasMore ? ". Execute novamente para continuar." : "."}`);
    await Promise.all([loadFiles(), loadMemories()]);
  }

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`O arquivo deve ter no máximo ${MAX_UPLOAD_LABEL}`);
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/context/files", { method: "POST", body: form });
    setUploading(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao enviar arquivo");
    toast.success("Arquivo enviado para processamento");
    await loadFiles();
  }

  async function addSite() {
    if (!siteUrl.trim()) return;
    setAddingSite(true);
    const response = await fetch("/api/context/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: siteUrl.trim() }) });
    setAddingSite(false);
    if (!response.ok) return toast.error((await response.json()).error ?? "Erro ao adicionar site");
    setSiteUrl("");
    toast.success("Site enviado para indexação");
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
          <label className="flex items-start gap-3 rounded-md border p-3"><input className="mt-1" type="checkbox" checked={autoLearn} onChange={(event) => setAutoLearn(event.target.checked)} /><span><span className="block font-medium">Aprendizado corporativo automático</span><span className="text-xs text-muted-foreground">Indexa documentos anexados e informações escritas pelos usuários, com origem auditável e gestão exclusiva do administrador.</span></span></label>
          <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{content.length.toLocaleString("pt-BR")} / 50.000 caracteres</span><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar diretrizes"}</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documentos, skills e arquivos</CardTitle><CardDescription>Conteúdo indexado na base geral e pesquisado em qualquer conversa quando for relevante.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Aceita Markdown, JPG/JPEG, PNG, SVG, Excel, Word, PowerPoint e HTML, até {MAX_UPLOAD_LABEL}.</p>
            <input ref={inputRef} className="hidden" type="file" accept=".md,.jpg,.jpeg,.png,.svg,.xlsx,.xls,.docx,.pptx,.html,.htm,.pdf,.txt,.csv,.json,.yaml,.yml" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
            <Button variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? "Enviando..." : "Adicionar arquivo"}</Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="url" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addSite(); } }} placeholder="https://www.exemplo.com.br/pagina" aria-label="Link de site externo" />
            <Button variant="outline" disabled={addingSite || !siteUrl.trim()} onClick={() => void addSite()}>{addingSite ? "Capturando..." : "Adicionar site"}</Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Arquivo</TableHead><TableHead>Origem</TableHead><TableHead>Tamanho</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {files.map((file) => <TableRow key={file.id}>
                  <TableCell className="font-medium"><a className="hover:underline" href={isExternalSource(file.filename) ? file.filename : `/api/files/${file.storagePath}`} target={isExternalSource(file.filename) ? "_blank" : undefined} rel="noreferrer">{file.filename}</a></TableCell><TableCell><div>{file.sourceType === "admin" ? "Administrador" : "Conversa"}</div>{file.sourceUserName && <div className="text-xs text-muted-foreground">{file.sourceUserName}</div>}</TableCell><TableCell>{formatSize(file.size)}</TableCell><TableCell><FileStatus file={file} /></TableCell>
                  <TableCell><div className="flex justify-end gap-1">{(file.status === "error" || file.stale) && <Button size="sm" variant="outline" disabled={busyFile === file.id} onClick={() => void fileAction(file, "POST")}>Tentar novamente</Button>}<Button size="icon-sm" variant="ghost" aria-label={`Remover ${file.filename}`} disabled={busyFile === file.id} onClick={() => void fileAction(file, "DELETE")}><XIcon /></Button></div></TableCell>
                </TableRow>)}
                {files.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum arquivo no contexto geral.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Memórias capturadas das conversas</CardTitle><CardDescription>Somente administradores visualizam o texto bruto, autor e origem. Remova informações incorretas ou inadequadas.</CardDescription></div><Button variant="outline" disabled={importing} onClick={() => void importHistory()}>{importing ? "Importando..." : "Importar histórico"}</Button></div></CardHeader>
        <CardContent><div className="max-h-[34rem] overflow-auto rounded-md border"><Table>
          <TableHeader><TableRow><TableHead>Informação</TableHead><TableHead>Autor</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{memories.map((memory) => <TableRow key={memory.id}>
            <TableCell className="max-w-md"><p className="line-clamp-3 whitespace-pre-wrap">{memory.content}</p><span className="text-xs text-muted-foreground">{memory.sourceType === "integration" ? `Integração: ${memory.sourceProvider ?? "externa"}` : memory.conversationId ? `Conversa ${memory.conversationId.slice(0, 8)}` : "Conversa"}</span></TableCell>
            <TableCell><div>{memory.userName ?? "Usuário removido"}</div><div className="text-xs text-muted-foreground">{memory.userEmail}</div></TableCell>
            <TableCell><Badge variant={memory.status === "error" ? "destructive" : memory.status === "ready" ? "default" : "secondary"}>{memory.status === "ready" ? "Pronta" : memory.status === "error" ? "Erro" : "Processando"}</Badge></TableCell>
            <TableCell className="whitespace-nowrap text-xs">{new Date(memory.createdAt).toLocaleString("pt-BR")}</TableCell>
            <TableCell><div className="flex justify-end gap-1">{memory.status === "error" && <Button size="sm" variant="outline" disabled={busyFile === memory.id} onClick={() => void memoryAction(memory, "POST")}>Reprocessar</Button>}<Button size="icon-sm" variant="ghost" disabled={busyFile === memory.id} aria-label="Remover memória" onClick={() => void memoryAction(memory, "DELETE")}><XIcon /></Button></div></TableCell>
          </TableRow>)}{memories.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma memória capturada.</TableCell></TableRow>}</TableBody>
        </Table></div></CardContent>
      </Card>
    </div>
  );
}

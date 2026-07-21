"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2Icon, TriangleAlertIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type AssistantFileRow = {
  id: string;
  assistantId: string;
  filename: string;
  mime: string;
  size: number;
  storagePath: string;
  status: "pending" | "processing" | "ready" | "error";
  error: string | null;
  createdAt: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StatusBadge({ status, error }: { status: AssistantFileRow["status"]; error: string | null }) {
  if (status === "pending" || status === "processing") {
    return (
      <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Loader2Icon className="size-3 animate-spin" />
        Processando…
      </Badge>
    );
  }
  if (status === "ready") {
    return (
      <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        Pronto
      </Badge>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="cursor-default">
            <TriangleAlertIcon className="size-3" />
            Erro
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{error ?? "Falha ao processar o arquivo"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AssistantFiles({ assistantId }: { assistantId: string }) {
  const [files, setFiles] = useState<AssistantFileRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/assistants/${assistantId}/files`);
      if (res.ok) setFiles(await res.json());
    } finally {
      setCarregando(false);
    }
  }, [assistantId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const pendente = files.some((f) => f.status === "pending" || f.status === "processing");
    if (!pendente) return;
    const intervalo = setInterval(carregar, 3000);
    return () => clearInterval(intervalo);
  }, [files, carregar]);

  async function enviarArquivo(arquivo: File) {
    setEnviando(true);
    const form = new FormData();
    form.append("file", arquivo);
    const res = await fetch(`/api/assistants/${assistantId}/files`, { method: "POST", body: form });
    setEnviando(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao enviar arquivo");
      return;
    }
    await carregar();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (arquivo) enviarArquivo(arquivo);
  }

  async function remover(file: AssistantFileRow) {
    setRemovendoId(file.id);
    const res = await fetch(`/api/assistants/${assistantId}/files/${file.id}`, { method: "DELETE" });
    setRemovendoId(null);
    if (!res.ok) {
      toast.error("Erro ao remover arquivo");
      return;
    }
    await carregar();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          PDFs e planilhas usados como referência pelo assistente nas respostas.
        </p>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.xlsx,.xls"
            className="hidden"
            onChange={onFileChange}
          />
          <Button
            type="button"
            variant="outline"
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
          >
            {enviando ? "Enviando..." : "Adicionar arquivo"}
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tamanho</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell className="font-medium">{file.filename}</TableCell>
              <TableCell className="text-muted-foreground">{formatSize(file.size)}</TableCell>
              <TableCell>
                <StatusBadge status={file.status} error={file.error} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remover arquivo"
                  disabled={removendoId === file.id}
                  onClick={() => remover(file)}
                >
                  <XIcon />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!carregando && files.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhum arquivo na base de conhecimento.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

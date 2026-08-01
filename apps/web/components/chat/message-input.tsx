"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CHAT_LIMITS } from "@/lib/ai/chat-policy";
import { Input } from "@/components/ui/input";
import { LinkIcon, Paperclip, SendHorizontal } from "lucide-react";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/files/policy";
import { ChatCapabilitySelectors, type ChatControls, type IntegrationOption, type SkillOption } from "./chat-capability-selectors";

// Formato compatível com FileUIPart (pacote "ai"): sendMessage({ text, files })
// aceita FileList | FileUIPart[], e é isso que anexamos aqui.
export type Attachment = { type: "file"; url: string; mediaType: string; filename: string };

export function MessageInput({
  onSend,
  disabled,
  initialText = "",
  suggestions = [],
  integrations = [],
  skills = [],
  defaultIntegrationId,
}: {
  onSend: (text: string, files: Attachment[], controls: ChatControls) => void;
  disabled: boolean;
  initialText?: string;
  suggestions?: string[];
  integrations?: IntegrationOption[];
  skills?: SkillOption[];
  defaultIntegrationId?: string | null;
}) {
  const [text, setText] = useState(initialText);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [mostrarLink, setMostrarLink] = useState(false);
  const [enviandoLink, setEnviandoLink] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [controls, setControls] = useState<ChatControls>({ generationMode: "chat", selectedIntegrationIds: [], selectedSkillIds: [] });
  const effectiveControls: ChatControls = {
    generationMode: controls.generationMode,
    selectedIntegrationIds: controls.selectedIntegrationIds.filter((id) => integrations.some((item) => item.id === id)),
    selectedSkillIds: controls.selectedSkillIds.filter((id) => skills.some((item) => item.id === id)),
  };

  async function attach(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selectedFiles.length === 0) return;

    const availableSlots = CHAT_LIMITS.maxAttachments - files.length;
    if (availableSlots <= 0) {
      toast.error(`Envie no máximo ${CHAT_LIMITS.maxAttachments} anexos`);
      return;
    }

    if (selectedFiles.length > availableSlots) {
      toast.warning(`Somente ${availableSlots} ${availableSlots === 1 ? "arquivo será adicionado" : "arquivos serão adicionados"}. O limite é de ${CHAT_LIMITS.maxAttachments} anexos.`);
    }

    const filesWithinLimit = selectedFiles.slice(0, availableSlots);
    const validFiles = filesWithinLimit.filter((file) => file.size <= MAX_UPLOAD_BYTES);
    const oversizedCount = filesWithinLimit.length - validFiles.length;
    if (oversizedCount > 0) {
      toast.error(`${oversizedCount === 1 ? "Um arquivo excede" : `${oversizedCount} arquivos excedem`} o limite de ${MAX_UPLOAD_LABEL} por arquivo`);
    }
    if (validFiles.length === 0) return;

    setEnviandoArquivo(true);
    try {
      const results = await Promise.allSettled(validFiles.map(async (file) => {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Falha no upload de ${file.name}`);
        }
        const meta = await res.json();
        return { type: "file", url: meta.url, mediaType: meta.mediaType, filename: meta.filename } satisfies Attachment;
      }));
      const uploaded = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const failed = results.filter((result) => result.status === "rejected");
      if (uploaded.length > 0) {
        setFiles((current) => [...current, ...uploaded].slice(0, CHAT_LIMITS.maxAttachments));
      }
      if (failed.length === 1) {
        toast.error(failed[0].reason instanceof Error ? failed[0].reason.message : "Falha no upload");
      } else if (failed.length > 1) {
        toast.error(`${failed.length} arquivos não puderam ser enviados`);
      }
    } finally {
      setEnviandoArquivo(false);
    }
  }

  async function attachLink() {
    if (!linkUrl.trim()) return;
    if (enviandoArquivo) return;
    if (files.length >= CHAT_LIMITS.maxAttachments) return toast.error(`Envie no máximo ${CHAT_LIMITS.maxAttachments} anexos`);
    setEnviandoLink(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: linkUrl.trim() }) });
      if (!res.ok) return toast.error((await res.json()).error ?? "Falha ao adicionar site");
      const meta = await res.json();
      setFiles((current) => [...current, { type: "file", url: meta.url, mediaType: meta.mediaType, filename: meta.filename }]);
      setLinkUrl("");
      setMostrarLink(false);
    } finally {
      setEnviandoLink(false);
    }
  }

  function submit() {
    if (disabled || enviandoArquivo || enviandoLink) return;
    if (!text.trim() && files.length === 0) return;
    onSend(text.trim(), files, effectiveControls);
    setText("");
    setFiles([]);
  }

  return (
    <div className="border-t px-2.5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:p-4">
      <ChatCapabilitySelectors integrations={integrations} skills={skills} controls={effectiveControls} onChange={setControls} defaultIntegrationId={defaultIntegrationId} />
      {effectiveControls.generationMode === "image" && (
        <div className="mb-2 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-2 text-xs text-foreground">
          <span className="font-medium text-fuchsia-500">Modo imagem ativo.</span> Descreva o que deseja e a imagem será gerada diretamente. Se faltar algum detalhe, a IA adotará uma opção adequada sem interromper para perguntar.
        </div>
      )}
      {suggestions.length > 0 && !text && (
        <div className="mb-3 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Experimente perguntar:</p>
          <div className="flex gap-2 overflow-x-auto pb-1">{suggestions.slice(0, 4).map((suggestion) => <button key={suggestion} type="button" className="max-w-xs shrink-0 rounded-full border bg-background px-3 py-1.5 text-left text-xs hover:border-primary hover:text-primary" onClick={() => setText(suggestion)}>{suggestion}</button>)}</div>
        </div>
      )}
      {mostrarLink && (
        <div className="mb-2 flex flex-col gap-2 sm:flex-row">
          <Input type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void attachLink(); } }} placeholder="https://www.exemplo.com.br/pagina" autoFocus />
          <Button className="w-full sm:w-auto" variant="outline" disabled={enviandoLink || !linkUrl.trim()} onClick={() => void attachLink()}>{enviandoLink ? "Capturando..." : "Adicionar"}</Button>
        </div>
      )}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="flex min-w-0 max-w-full items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
              <span className="truncate">{f.filename}</span>
              <button className="shrink-0" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remover">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="rounded-xl border bg-background p-2 focus-within:ring-2 focus-within:ring-ring/40">
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept=".md,.jpg,.jpeg,.png,.svg,.xlsx,.xls,.docx,.pptx,.html,.htm,.pdf,.txt,.csv,.json,.yaml,.yml,.webp"
          onChange={attach}
        />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={effectiveControls.generationMode === "image" ? "Descreva a imagem que deseja criar..." : "Envie uma mensagem..."}
          rows={1}
          maxLength={CHAT_LIMITS.maxMessageChars}
          className="max-h-40 min-h-[44px] resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="mt-1 flex items-center gap-1">
          <Button className="size-10 sm:size-8" variant="ghost" size="icon" onClick={() => inputRef.current?.click()} disabled={enviandoArquivo} aria-label="Anexar arquivos"><Paperclip /></Button>
          <Button className="size-10 sm:size-8" variant={mostrarLink ? "secondary" : "ghost"} size="icon" onClick={() => setMostrarLink((value) => !value)} disabled={enviandoArquivo || enviandoLink} aria-label="Adicionar link de site externo"><LinkIcon /></Button>
          <div className="flex-1" />
          <Button className="h-10 px-3 sm:h-8" onClick={submit} disabled={disabled || enviandoArquivo || enviandoLink} aria-label={effectiveControls.generationMode === "image" ? "Gerar imagem" : "Enviar mensagem"}><SendHorizontal /><span className="hidden sm:inline">{effectiveControls.generationMode === "image" ? "Gerar imagem" : "Enviar"}</span></Button>
        </div>
      </div>
      <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
        Até {CHAT_LIMITS.maxMessageChars.toLocaleString("pt-BR")} caracteres, {CHAT_LIMITS.maxAttachments} anexos e {MAX_UPLOAD_LABEL} por arquivo. O Sequor IA Assistente pode cometer erros.
      </p>
      <p className="mt-1 text-center text-[11px] text-muted-foreground sm:hidden">O Sequor IA Assistente pode cometer erros.</p>
    </div>
  );
}

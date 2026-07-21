"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// Formato compatível com FileUIPart (pacote "ai"): sendMessage({ text, files })
// aceita FileList | FileUIPart[], e é isso que anexamos aqui.
export type Attachment = { type: "file"; url: string; mediaType: string; filename: string };

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (text: string, files: Attachment[]) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function attach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoArquivo(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        toast.error((await res.json()).error ?? "Falha no upload");
        return;
      }
      const meta = await res.json();
      setFiles((f) => [...f, { type: "file", url: meta.url, mediaType: meta.mediaType, filename: meta.filename }]);
    } finally {
      setEnviandoArquivo(false);
      e.target.value = "";
    }
  }

  function submit() {
    if (disabled) return;
    if (!text.trim() && files.length === 0) return;
    onSend(text.trim(), files);
    setText("");
    setFiles([]);
  }

  return (
    <div className="border-t p-4">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
              {f.filename}
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remover">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={inputRef}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={attach}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => inputRef.current?.click()}
          disabled={enviandoArquivo}
          aria-label="Anexar arquivo"
        >
          +
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Envie uma mensagem..."
          rows={1}
          className="max-h-40 min-h-[44px] resize-none"
        />
        <Button onClick={submit} disabled={disabled}>
          Enviar
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        O G4 IA Assistente pode cometer erros. Confira informações importantes.
      </p>
    </div>
  );
}

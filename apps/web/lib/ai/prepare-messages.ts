import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";
import { readUpload } from "@/lib/files/storage";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_PDF_CHARS = 60_000; // ~15k tokens; acima disso trunca com aviso

async function defaultExtractPdfText(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

type Deps = {
  readFile: (storedName: string) => Promise<{ buf: Buffer; mime: string }>;
  extractPdfText: (buf: Buffer) => Promise<string>;
};

const defaultDeps: Deps = {
  readFile: readUpload,
  extractPdfText: defaultExtractPdfText,
};

export async function prepareModelMessages(uiMessages: UIMessage[], deps: Deps = defaultDeps): Promise<ModelMessage[]> {
  const transformed: UIMessage[] = [];
  for (const msg of uiMessages) {
    const parts: UIMessage["parts"] = [];
    for (const part of msg.parts) {
      if (part.type !== "file") { parts.push(part); continue; }
      if (!part.url.startsWith("/api/files/")) continue; // descarta URLs externas
      const storedName = part.url.slice("/api/files/".length);
      const { buf, mime } = await deps.readFile(storedName);
      if (mime === "application/pdf") {
        let text = await deps.extractPdfText(buf);
        if (text.length > MAX_PDF_CHARS) {
          text = text.slice(0, MAX_PDF_CHARS) + "\n[Documento truncado por tamanho]";
        }
        parts.push({ type: "text", text: `Conteúdo do arquivo "${part.filename}":\n\n${text}` });
      } else if (mime.startsWith("image/")) {
        parts.push({ ...part, url: `data:${mime};base64,${buf.toString("base64")}` });
      }
    }
    transformed.push({ ...msg, parts });
  }
  return convertToModelMessages(transformed);
}

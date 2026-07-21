import { eq } from "drizzle-orm";
import { embedMany } from "ai";
import { assistantFiles, chunks } from "@/lib/db/schema";
import { readUpload } from "@/lib/files/storage";
import { extractTextFromFile } from "./extract";
import { chunkText } from "./chunking";
import { getProvider } from "@/lib/ai/provider";
import type { Db } from "@/lib/db";

type Deps = { embed: (texts: string[]) => Promise<number[][]> };

export async function ingestFile(db: Db, fileId: string, deps: Deps) {
  const [file] = await db.select().from(assistantFiles).where(eq(assistantFiles.id, fileId));
  if (!file) throw new Error("Arquivo não encontrado");
  await db.update(assistantFiles).set({ status: "processing", error: null }).where(eq(assistantFiles.id, fileId));
  try {
    const { buf } = await readUpload(file.storagePath);
    const text = await extractTextFromFile(buf, file.mime);
    const parts = chunkText(text);
    if (parts.length === 0) throw new Error("Nenhum texto extraído do arquivo");

    await db.delete(chunks).where(eq(chunks.fileId, fileId)); // reprocessamento idempotente
    for (let i = 0; i < parts.length; i += 100) {
      const lote = parts.slice(i, i + 100);
      const embeddings = await deps.embed(lote);
      await db.insert(chunks).values(lote.map((content, j) => ({
        fileId, assistantId: file.assistantId, content, chunkIndex: i + j, embedding: embeddings[j],
      })));
    }
    await db.update(assistantFiles).set({ status: "ready" }).where(eq(assistantFiles.id, fileId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(assistantFiles).set({ status: "error", error: msg }).where(eq(assistantFiles.id, fileId));
  }
}

export function startIngestion(db: Db, fileId: string) {
  const realEmbed = async (texts: string[]) => {
    const openai = await getProvider(db);
    const { embeddings } = await embedMany({
      model: openai.textEmbeddingModel("text-embedding-3-small"),
      values: texts,
    });
    return embeddings;
  };
  void ingestFile(db, fileId, { embed: realEmbed }).catch((e) => {
    console.error(`[ingestão] falha no arquivo ${fileId}:`, e);
  });
}

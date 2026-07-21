import { embed, tool } from "ai";
import { z } from "zod";
import { searchChunks } from "@/lib/rag/search";
import type { Db } from "@/lib/db";
import type { createOpenAI } from "@ai-sdk/openai";

export function makeKnowledgeTool(db: Db, openai: ReturnType<typeof createOpenAI>, assistantId: string) {
  return tool({
    description: "Busca trechos relevantes na base de conhecimento deste assistente (documentos enviados pelo administrador). Use sempre que a pergunta puder ser respondida por esses documentos.",
    inputSchema: z.object({
      consulta: z.string().describe("Pergunta ou termos de busca em português"),
    }),
    execute: async ({ consulta }) => {
      const { embedding } = await embed({
        model: openai.textEmbeddingModel("text-embedding-3-small"),
        value: consulta,
      });
      const resultados = await searchChunks(db, assistantId, embedding);
      if (resultados.length === 0) return "Nenhum trecho relevante encontrado na base de conhecimento.";
      return resultados.map((r, i) => `[${i + 1}] (${r.filename})\n${r.content}`).join("\n\n---\n\n");
    },
  });
}

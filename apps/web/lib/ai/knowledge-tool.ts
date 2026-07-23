import { embed, tool } from "ai";
import { z } from "zod";
import { searchKnowledge } from "@/lib/rag/search";
import type { Db } from "@/lib/db";
import type { createOpenAI } from "@ai-sdk/openai";

export function makeKnowledgeTool(
  db: Db,
  openai: ReturnType<typeof createOpenAI>,
  assistantId: string | null,
  projectId: string | null,
  options?: {
    onEmbeddingUsage?: (usage: { tokens: number; durationMs: number; success: boolean }) => Promise<void>;
    beforeCall?: () => void;
  },
) {
  return tool({
    description: "Busca trechos relevantes no projeto atual, no contexto corporativo geral e na base deste assistente. Use sempre que a pergunta puder depender de políticas, processos, dados ou documentos disponíveis.",
    inputSchema: z.object({
      consulta: z.string().describe("Pergunta ou termos de busca em português"),
    }),
    execute: async ({ consulta }) => {
      options?.beforeCall?.();
      const startedAt = Date.now();
      let embedding: number[];
      try {
        const result = await embed({
          model: openai.textEmbeddingModel("text-embedding-3-small"),
          value: consulta,
        });
        embedding = result.embedding;
        await options?.onEmbeddingUsage?.({ tokens: result.usage.tokens, durationMs: Date.now() - startedAt, success: true });
      } catch (error) {
        await options?.onEmbeddingUsage?.({ tokens: 0, durationMs: Date.now() - startedAt, success: false });
        throw error;
      }
      const resultados = await searchKnowledge(db, assistantId, projectId, embedding);
      if (resultados.length === 0) return "Nenhum trecho relevante encontrado na base de conhecimento.";
      return resultados.map((r, i) =>
        `[${i + 1}] Fonte: ${r.filename}\n<documento_nao_confiavel>\n${r.content}\n</documento_nao_confiavel>`,
      ).join("\n\n---\n\n");
    },
  });
}

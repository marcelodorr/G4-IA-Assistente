import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { generateBudgetDocument, generateDocument, generateImage, generatePresentation, generateSpreadsheet } from "@/lib/services/artifacts";
import type { Db } from "@/lib/db";
import type { AgentType } from "@/lib/ai/agent-types";

type Owner = { userId: string; conversationId: string; assistantId?: string | null };

const artifactResult = (artifact: { filename: string; url: string }) => ({
  success: true,
  filename: artifact.filename,
  downloadUrl: artifact.url,
  instruction: `Entregue ao usuário este link para download: [Baixar ${artifact.filename}](${artifact.url})`,
});

const sectionsSchema = z.array(z.object({
  heading: z.string().min(1).max(200),
  content: z.string().min(1).max(20_000),
})).min(1).max(40);

const tableSchema = {
  title: z.string().min(1).max(200),
  headers: z.array(z.string().max(100)).min(1).max(20),
  rows: z.array(z.array(z.union([z.string().max(1_000), z.number()])).max(20)).min(1).max(500),
  notes: z.string().max(10_000).optional(),
};

export function createAgentTools(db: Db, agentType: AgentType, owner: Owner, options?: { beforeCall?: () => void }): ToolSet {
  if (agentType === "image") return {
    gerarImagem: tool({
      description: "Gera uma imagem PNG final e retorna um link interno para download. Use quando o usuário pedir criação visual.",
      inputSchema: z.object({
        prompt: z.string().min(3).max(8_000).describe("Descrição visual detalhada, incluindo objetivo, composição, cores e textos necessários"),
        size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).default("1024x1024"),
        quality: z.enum(["low", "medium", "high"]).default("medium"),
      }),
      execute: async (input) => { options?.beforeCall?.(); return artifactResult(await generateImage(db, owner, input)); },
    }),
  };

  if (agentType === "budget") return {
    gerarOrcamento: tool({
      description: "Gera um orçamento estruturado em Excel, Word ou PDF. XLSX abre no Google Planilhas e DOCX abre no Google Docs.",
      inputSchema: z.object({ ...tableSchema, format: z.enum(["xlsx", "docx", "pdf", "google_sheets", "google_docs"]) }),
      execute: async ({ format, ...input }) => {
        options?.beforeCall?.();
        return artifactResult((format === "xlsx" || format === "google_sheets")
          ? await generateSpreadsheet(db, owner, input)
          : await generateBudgetDocument(db, owner, { ...input, format: format === "pdf" ? "pdf" : "docx" }));
      },
    }),
  };

  if (agentType === "presentation") return {
    gerarApresentacao: tool({
      description: "Gera uma apresentação final em PowerPoint ou PDF. PPTX pode ser importado no Google Slides.",
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        slides: z.array(z.object({ title: z.string().min(1).max(200), bullets: z.array(z.string().min(1).max(1_000)).min(1).max(12) })).min(1).max(40),
        format: z.enum(["pptx", "pdf", "google_slides"]),
      }),
      execute: async ({ format, ...input }) => { options?.beforeCall?.(); return artifactResult(await generatePresentation(db, owner, { ...input, format: format === "pdf" ? "pdf" : "pptx" })); },
    }),
  };

  if (agentType === "document") return {
    gerarDocumento: tool({
      description: "Gera documentação corporativa em Word ou PDF. DOCX pode ser aberto ou importado no Google Docs.",
      inputSchema: z.object({ title: z.string().min(1).max(200), sections: sectionsSchema, format: z.enum(["docx", "pdf", "google_docs"]) }),
      execute: async ({ format, ...input }) => { options?.beforeCall?.(); return artifactResult(await generateDocument(db, owner, { ...input, format: format === "pdf" ? "pdf" : "docx" })); },
    }),
  };

  return {};
}

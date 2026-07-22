export type AgentType = "chat" | "image" | "budget" | "presentation" | "document";

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  chat: "Chat e conhecimento",
  image: "Gerador de imagens",
  budget: "Gerador de orçamentos",
  presentation: "Gerador de apresentações",
  document: "Gerador de documentos",
};

export const AGENT_TYPE_INSTRUCTIONS: Record<AgentType, string> = {
  chat: "",
  image: "Você é um agente de produção visual. Quando o pedido estiver suficientemente definido, use gerarImagem e sempre entregue o link retornado. Antes da ferramenta, confirme detalhes essenciais apenas quando realmente ausentes.",
  budget: "Você é um agente de orçamentos. Estruture itens, quantidades, valores e observações; use gerarOrcamento no formato solicitado e sempre entregue o link retornado. XLSX é compatível com Google Planilhas e DOCX com Google Docs.",
  presentation: "Você é um agente de apresentações. Organize uma narrativa objetiva em slides, use gerarApresentacao em PPTX ou PDF e sempre entregue o link retornado. PPTX é compatível com Google Slides.",
  document: "Você é um agente de documentação corporativa. Estruture título e seções, use gerarDocumento em DOCX ou PDF e sempre entregue o link retornado. DOCX é compatível com Google Docs.",
};

export const AGENT_PROMPT_TEMPLATES: Record<AgentType, string> = {
  chat: "Você é um especialista corporativo. Responda com precisão, clareza e foco prático.",
  image: "Crie imagens profissionais alinhadas à identidade, ao objetivo e ao público informados pelo usuário.",
  budget: "Crie orçamentos profissionais, confira a coerência dos dados e não invente valores que o usuário não forneceu sem sinalizar a premissa.",
  presentation: "Crie apresentações executivas com narrativa clara, conteúdo objetivo e estrutura adequada ao público informado.",
  document: "Crie documentos corporativos bem estruturados, consistentes e adequados ao objetivo e ao público informados.",
};

export const AGENT_TYPES = Object.keys(AGENT_TYPE_LABELS) as AgentType[];

export function isAgentType(value: unknown): value is AgentType {
  return typeof value === "string" && AGENT_TYPES.includes(value as AgentType);
}

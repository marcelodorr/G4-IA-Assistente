import { isIntegrationProvider, type IntegrationProvider } from "@/lib/integrations/catalog";

export function parseChatSelections(body: { generationMode?: unknown; selectedIntegrationIds?: unknown; selectedSkillIds?: unknown }) {
  const parseIds = (value: unknown, label: string, max: number) => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > max || value.some((id) => typeof id !== "string")) throw new Error(`${label} inválidas`);
    return [...new Set(value as string[])];
  };
  const selectedIntegrationIds = parseIds(body.selectedIntegrationIds, "Integrações selecionadas", 6);
  if (selectedIntegrationIds.some((id) => !isIntegrationProvider(id))) throw new Error("Integração selecionada inválida");
  if (body.generationMode !== undefined && body.generationMode !== "chat" && body.generationMode !== "image") throw new Error("Modo de geração inválido");
  return {
    generationMode: body.generationMode === "image" ? "image" as const : "chat" as const,
    selectedIntegrationIds: selectedIntegrationIds as IntegrationProvider[],
    selectedSkillIds: parseIds(body.selectedSkillIds, "Skills selecionadas", 20),
  };
}

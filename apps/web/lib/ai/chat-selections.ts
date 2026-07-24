import { isIntegrationProvider, type IntegrationProvider } from "@/lib/integrations/catalog";

export function parseChatSelections(body: { selectedIntegrationIds?: unknown; selectedSkillIds?: unknown }) {
  const parseIds = (value: unknown, label: string, max: number) => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > max || value.some((id) => typeof id !== "string")) throw new Error(`${label} inválidas`);
    return [...new Set(value as string[])];
  };
  const selectedIntegrationIds = parseIds(body.selectedIntegrationIds, "Integrações selecionadas", 6);
  if (selectedIntegrationIds.some((id) => !isIntegrationProvider(id))) throw new Error("Integração selecionada inválida");
  return {
    selectedIntegrationIds: selectedIntegrationIds as IntegrationProvider[],
    selectedSkillIds: parseIds(body.selectedSkillIds, "Skills selecionadas", 20),
  };
}

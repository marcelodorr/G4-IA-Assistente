import { and, eq, inArray } from "drizzle-orm";
import { assistants } from "@/lib/db/schema";
import { isAllowedModel } from "@/lib/ai/models";
import { getUserAccess } from "@/lib/services/users";
import { isAgentType, type AgentType } from "@/lib/ai/agent-types";
import type { Db } from "@/lib/db";
import { isIntegrationProvider, type IntegrationProvider } from "@/lib/integrations/catalog";

type CreateInput = { name: string; systemPrompt: string; description?: string; model?: string | null; agentType?: AgentType; integrationProvider?: IntegrationProvider | null; createdBy: string };

export async function createAssistant(db: Db, input: CreateInput) {
  if (!input.name.trim()) throw new Error("Nome do assistente é obrigatório");
  if (!input.systemPrompt.trim()) throw new Error("System prompt é obrigatório");
  if (input.model && !isAllowedModel(input.model)) throw new Error("Modelo inválido");
  if (input.agentType && !isAgentType(input.agentType)) throw new Error("Tipo de agente inválido");
  if (input.integrationProvider && !isIntegrationProvider(input.integrationProvider)) throw new Error("Integração padrão inválida");
  const [row] = await db.insert(assistants).values({
    name: input.name.trim(), systemPrompt: input.systemPrompt,
    description: input.description ?? null, model: input.model ?? null, agentType: input.agentType ?? "chat",
    integrationProvider: input.integrationProvider ?? null, createdBy: input.createdBy,
  }).returning();
  return row;
}

export async function updateAssistant(db: Db, id: string, patch: Partial<CreateInput & { active: boolean }>) {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error("Nome do assistente é obrigatório");
  if (patch.systemPrompt !== undefined && !patch.systemPrompt.trim()) throw new Error("System prompt é obrigatório");
  if (patch.model && !isAllowedModel(patch.model)) throw new Error("Modelo inválido");
  if (patch.agentType !== undefined && !isAgentType(patch.agentType)) throw new Error("Tipo de agente inválido");
  if (patch.integrationProvider !== undefined && patch.integrationProvider !== null && !isIntegrationProvider(patch.integrationProvider)) throw new Error("Integração padrão inválida");
  await db.update(assistants).set(patch).where(eq(assistants.id, id));
}

export async function listAssistants(db: Db, opts: { onlyActive?: boolean }) {
  const q = db.select().from(assistants);
  return opts.onlyActive ? q.where(eq(assistants.active, true)) : q;
}

export async function getAssistant(db: Db, id: string) {
  return (await db.select().from(assistants).where(eq(assistants.id, id)))[0] ?? null;
}

export async function listAssistantsForUser(db: Db, userId: string) {
  const access = await getUserAccess(db, userId);
  if (access.assistantAccessMode === "all") return listAssistants(db, { onlyActive: true });
  if (access.assistantIds.length === 0) return [];
  return db.select().from(assistants).where(and(
    eq(assistants.active, true),
    inArray(assistants.id, access.assistantIds),
  ));
}

export async function canUserAccessAssistant(db: Db, userId: string, assistantId: string) {
  const rows = await listAssistantsForUser(db, userId);
  return rows.some((assistant) => assistant.id === assistantId);
}

export async function deleteAssistant(db: Db, id: string) {
  await db.delete(assistants).where(eq(assistants.id, id));
}

// Forma reduzida exposta a usuários não-admin (sem `systemPrompt`) — ver app/api/assistants/route.ts.
export type AssistantSummary = Pick<Awaited<ReturnType<typeof listAssistants>>[number], "id" | "name" | "description" | "agentType" | "integrationProvider">;

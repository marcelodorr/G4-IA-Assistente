import { eq } from "drizzle-orm";
import { assistants } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

type CreateInput = { name: string; systemPrompt: string; description?: string; model?: string | null; createdBy: string };

export async function createAssistant(db: Db, input: CreateInput) {
  if (!input.name.trim()) throw new Error("Nome do assistente é obrigatório");
  if (!input.systemPrompt.trim()) throw new Error("System prompt é obrigatório");
  const [row] = await db.insert(assistants).values({
    name: input.name.trim(), systemPrompt: input.systemPrompt,
    description: input.description ?? null, model: input.model ?? null, createdBy: input.createdBy,
  }).returning();
  return row;
}

export async function updateAssistant(db: Db, id: string, patch: Partial<CreateInput & { active: boolean }>) {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error("Nome do assistente é obrigatório");
  if (patch.systemPrompt !== undefined && !patch.systemPrompt.trim()) throw new Error("System prompt é obrigatório");
  await db.update(assistants).set(patch).where(eq(assistants.id, id));
}

export async function listAssistants(db: Db, opts: { onlyActive?: boolean }) {
  const q = db.select().from(assistants);
  return opts.onlyActive ? q.where(eq(assistants.active, true)) : q;
}

export async function getAssistant(db: Db, id: string) {
  return (await db.select().from(assistants).where(eq(assistants.id, id)))[0] ?? null;
}

export async function deleteAssistant(db: Db, id: string) {
  await db.delete(assistants).where(eq(assistants.id, id));
}

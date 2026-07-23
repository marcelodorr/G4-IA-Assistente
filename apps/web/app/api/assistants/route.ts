import { db } from "@/lib/db";
import { createAssistant, listAssistants, listAssistantsForUser } from "@/lib/services/assistants";
import { apiHandler, requireAdmin, requireSession } from "@/lib/services/guards";
import { getSettings } from "@/lib/services/settings";
import { isModelEnabled } from "@/lib/ai/models";

export const GET = apiHandler(async (req) => {
  const session = await requireSession();
  const onlyActive = new URL(req.url).searchParams.get("active") === "1";
  const rows = session.user.role === "admin" && !onlyActive
    ? await listAssistants(db, {})
    : await listAssistantsForUser(db, session.user.id);
  if (session.user.role !== "admin" || onlyActive) {
    // Membros não podem ver o systemPrompt dos assistentes (só admins editam/usam a página admin).
    return Response.json(
      rows.map(({ id, name, description, model, agentType, integrationProvider, active, createdAt }) => ({ id, name, description, model, agentType, integrationProvider, active, createdAt }))
    );
  }
  return Response.json(rows);
});

export const POST = apiHandler(async (req) => {
  const session = await requireAdmin();
  const { name, systemPrompt, description, model, agentType, integrationProvider } = await req.json();
  const settings = await getSettings(db);
  if (model && !isModelEnabled(model, settings.disabledModels)) {
    return Response.json({ error: "Modelo inválido ou desabilitado" }, { status: 400 });
  }
  const row = await createAssistant(db, { name, systemPrompt, description, model, agentType, integrationProvider, createdBy: session.user.id });
  return Response.json(row, { status: 201 });
});

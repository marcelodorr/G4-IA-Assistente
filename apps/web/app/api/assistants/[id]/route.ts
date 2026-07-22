import { db } from "@/lib/db";
import { getAssistant, updateAssistant, deleteAssistant } from "@/lib/services/assistants";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { getSettings } from "@/lib/services/settings";
import { isModelEnabled } from "@/lib/ai/models";

export const GET = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const row = await getAssistant(db, id);
  if (!row) return Response.json({ error: "Assistente não encontrado" }, { status: 404 });
  return Response.json(row);
});

export const PATCH = apiHandler(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const patch = await req.json();
  const settings = await getSettings(db);
  if (patch.model && !isModelEnabled(patch.model, settings.disabledModels)) {
    return Response.json({ error: "Modelo inválido ou desabilitado" }, { status: 400 });
  }
  await updateAssistant(db, id, patch);
  return new Response(null, { status: 204 });
});

export const DELETE = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await deleteAssistant(db, id);
  return new Response(null, { status: 204 });
});

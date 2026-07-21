import { db } from "@/lib/db";
import { getAssistant, updateAssistant, deleteAssistant } from "@/lib/services/assistants";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

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
  await updateAssistant(db, id, await req.json());
  return new Response(null, { status: 204 });
});

export const DELETE = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await deleteAssistant(db, id);
  return new Response(null, { status: 204 });
});

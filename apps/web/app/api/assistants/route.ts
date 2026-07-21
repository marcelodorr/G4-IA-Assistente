import { db } from "@/lib/db";
import { createAssistant, listAssistants } from "@/lib/services/assistants";
import { apiHandler, requireAdmin, requireSession } from "@/lib/services/guards";

export const GET = apiHandler(async (req) => {
  await requireSession();
  const onlyActive = new URL(req.url).searchParams.get("active") === "1";
  return Response.json(await listAssistants(db, { onlyActive }));
});

export const POST = apiHandler(async (req) => {
  const session = await requireAdmin();
  const { name, systemPrompt, description, model } = await req.json();
  const row = await createAssistant(db, { name, systemPrompt, description, model, createdBy: session.user.id });
  return Response.json(row, { status: 201 });
});

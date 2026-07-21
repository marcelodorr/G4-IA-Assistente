import { db } from "@/lib/db";
import { createAssistant, listAssistants } from "@/lib/services/assistants";
import { apiHandler, requireAdmin, requireSession } from "@/lib/services/guards";

export const GET = apiHandler(async (req) => {
  const session = await requireSession();
  const onlyActive = new URL(req.url).searchParams.get("active") === "1";
  const rows = await listAssistants(db, { onlyActive });
  if (session.user.role !== "admin") {
    // Membros não podem ver o systemPrompt dos assistentes (só admins editam/usam a página admin).
    return Response.json(
      rows.map(({ id, name, description, model, active, createdAt }) => ({ id, name, description, model, active, createdAt }))
    );
  }
  return Response.json(rows);
});

export const POST = apiHandler(async (req) => {
  const session = await requireAdmin();
  const { name, systemPrompt, description, model } = await req.json();
  const row = await createAssistant(db, { name, systemPrompt, description, model, createdBy: session.user.id });
  return Response.json(row, { status: 201 });
});

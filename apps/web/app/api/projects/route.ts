import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { createProject, listProjects } from "@/lib/services/projects";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  return Response.json(await listProjects(db, session.user.id));
});

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const body = await req.json().catch(() => ({})) as { name?: unknown; description?: unknown; context?: unknown };
  if (typeof body.name !== "string") throw new Error("Nome do projeto é obrigatório");
  const project = await createProject(db, {
    userId: session.user.id,
    name: body.name,
    description: typeof body.description === "string" ? body.description : undefined,
    context: typeof body.context === "string" ? body.context : undefined,
  });
  return Response.json(project, { status: 201 });
});

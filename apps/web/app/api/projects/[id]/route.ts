import { unlink } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectFiles } from "@/lib/db/schema";
import { uploadsDir } from "@/lib/files/storage";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { deleteProject, getProject, updateProject } from "@/lib/services/projects";

export const GET = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const project = await getProject(db, id, session.user.id);
  if (!project) return Response.json({ error: "Projeto não encontrado" }, { status: 404 });
  return Response.json(project);
});

export const PATCH = apiHandler(async (req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { name?: unknown; description?: unknown; context?: unknown };
  const project = await updateProject(db, id, session.user.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    description: typeof body.description === "string" || body.description === null ? body.description : undefined,
    context: typeof body.context === "string" ? body.context : undefined,
  });
  if (!project) return Response.json({ error: "Projeto não encontrado" }, { status: 404 });
  return Response.json(project);
});

export const DELETE = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const project = await getProject(db, id, session.user.id);
  if (!project) return new Response(null, { status: 204 });
  const files = await db.select({ storagePath: projectFiles.storagePath }).from(projectFiles).where(eq(projectFiles.projectId, id));
  await deleteProject(db, id, session.user.id);
  await Promise.all(files.map((file) => unlink(path.join(uploadsDir(), file.storagePath)).catch(() => {})));
  return new Response(null, { status: 204 });
});

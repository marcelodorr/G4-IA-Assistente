import { unlink } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectFiles } from "@/lib/db/schema";
import { uploadsDir } from "@/lib/files/storage";
import { startProjectFileIngestion } from "@/lib/rag/ingest";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { getProjectFile } from "@/lib/services/projects";

export const POST = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id, fileId } = await params;
  const file = await getProjectFile(db, id, fileId, session.user.id);
  if (!file) return Response.json({ error: "Arquivo não encontrado" }, { status: 404 });
  const stale = Date.now() - file.createdAt.getTime() > 10 * 60_000;
  if ((file.status === "pending" || file.status === "processing") && !stale) return Response.json({ error: "O arquivo já está sendo processado" }, { status: 409 });
  await db.update(projectFiles).set({ status: "pending", error: null }).where(eq(projectFiles.id, fileId));
  startProjectFileIngestion(db, fileId);
  return Response.json({ status: "pending" }, { status: 202 });
});

export const DELETE = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id, fileId } = await params;
  const file = await getProjectFile(db, id, fileId, session.user.id);
  if (file) {
    await db.delete(projectFiles).where(eq(projectFiles.id, fileId));
    await unlink(path.join(uploadsDir(), file.storagePath)).catch(() => {});
  }
  return new Response(null, { status: 204 });
});

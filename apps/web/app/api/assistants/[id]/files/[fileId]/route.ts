import { unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { assistantFiles } from "@/lib/db/schema";
import { uploadsDir } from "@/lib/files/storage";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { eq } from "drizzle-orm";
import { startIngestion } from "@/lib/rag/ingest";

export const POST = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { fileId } = await params;
  const [row] = await db.select().from(assistantFiles).where(eq(assistantFiles.id, fileId));
  if (!row) return Response.json({ error: "Documento não encontrado" }, { status: 404 });
  const stale = Date.now() - row.createdAt.getTime() > 10 * 60_000;
  if ((row.status === "pending" || row.status === "processing") && !stale) {
    return Response.json({ error: "O documento já está sendo processado" }, { status: 409 });
  }
  await db.update(assistantFiles).set({ status: "pending", error: null }).where(eq(assistantFiles.id, fileId));
  startIngestion(db, fileId);
  return Response.json({ status: "pending" }, { status: 202 });
});

export const DELETE = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { fileId } = await params;
  const [row] = await db.select().from(assistantFiles).where(eq(assistantFiles.id, fileId));
  if (row) {
    await db.delete(assistantFiles).where(eq(assistantFiles.id, fileId));
    await unlink(path.join(uploadsDir(), row.storagePath)).catch(() => {});
  }
  return new Response(null, { status: 204 });
});

import { unlink } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { globalContextFiles } from "@/lib/db/schema";
import { uploadsDir } from "@/lib/files/storage";
import { startGlobalContextIngestion } from "@/lib/rag/ingest";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const POST = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { fileId } = await params;
  const [row] = await db.select().from(globalContextFiles).where(eq(globalContextFiles.id, fileId));
  if (!row) return Response.json({ error: "Documento não encontrado" }, { status: 404 });
  const stale = Date.now() - row.createdAt.getTime() > 10 * 60_000;
  if ((row.status === "pending" || row.status === "processing") && !stale) {
    return Response.json({ error: "O documento já está sendo processado" }, { status: 409 });
  }
  await db.update(globalContextFiles).set({ status: "pending", error: null }).where(eq(globalContextFiles.id, fileId));
  startGlobalContextIngestion(db, fileId);
  return Response.json({ status: "pending" }, { status: 202 });
});

export const DELETE = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { fileId } = await params;
  const [row] = await db.select().from(globalContextFiles).where(eq(globalContextFiles.id, fileId));
  if (row) {
    await db.delete(globalContextFiles).where(eq(globalContextFiles.id, fileId));
    await unlink(path.join(uploadsDir(), row.storagePath)).catch(() => {});
  }
  return new Response(null, { status: 204 });
});

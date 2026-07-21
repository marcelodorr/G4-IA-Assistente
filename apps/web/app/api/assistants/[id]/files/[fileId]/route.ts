import { unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { assistantFiles } from "@/lib/db/schema";
import { uploadsDir } from "@/lib/files/storage";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { eq } from "drizzle-orm";

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

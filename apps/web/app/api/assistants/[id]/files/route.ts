import { db } from "@/lib/db";
import { assistantFiles } from "@/lib/db/schema";
import { saveUpload, KB_MIMES } from "@/lib/files/storage";
import { startIngestion } from "@/lib/rag/ingest";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { desc, eq } from "drizzle-orm";

export const GET = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const rows = await db.select().from(assistantFiles)
    .where(eq(assistantFiles.assistantId, id)).orderBy(desc(assistantFiles.createdAt));
  return Response.json(rows.map((row) => ({
    ...row,
    stale: (row.status === "pending" || row.status === "processing")
      && Date.now() - row.createdAt.getTime() > 10 * 60_000,
  })));
});

export const POST = apiHandler(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const { storedName } = await saveUpload(buf, file.name, file.type, KB_MIMES);
  const [row] = await db.insert(assistantFiles).values({
    assistantId: id, filename: file.name, mime: file.type, size: buf.byteLength, storagePath: storedName,
  }).returning();
  startIngestion(db, row.id);
  return Response.json(row, { status: 202 });
});

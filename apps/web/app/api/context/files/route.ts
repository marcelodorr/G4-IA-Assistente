import { db } from "@/lib/db";
import { globalContextFiles } from "@/lib/db/schema";
import { KB_MIMES, saveUpload } from "@/lib/files/storage";
import { startGlobalContextIngestion } from "@/lib/rag/ingest";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { listGlobalContextFiles } from "@/lib/services/global-context";

export const GET = apiHandler(async () => {
  await requireAdmin();
  const rows = await listGlobalContextFiles(db);
  return Response.json(rows.map((row) => ({
    ...row,
    stale: (row.status === "pending" || row.status === "processing")
      && Date.now() - row.createdAt.getTime() > 10 * 60_000,
  })));
});

export const POST = apiHandler(async (req) => {
  const session = await requireAdmin();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const { storedName, mime } = await saveUpload(buffer, file.name, file.type, KB_MIMES);
  const [row] = await db.insert(globalContextFiles).values({
    filename: file.name,
    mime,
    size: buffer.byteLength,
    storagePath: storedName,
    createdBy: session.user.id,
  }).returning();
  startGlobalContextIngestion(db, row.id);
  return Response.json(row, { status: 202 });
});

import { saveUpload, CHAT_MIMES, KB_MIMES } from "@/lib/files/storage";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { db } from "@/lib/db";
import { chatUploads, globalContextFiles } from "@/lib/db/schema";
import { getSettings } from "@/lib/services/settings";
import { startGlobalContextIngestion } from "@/lib/rag/ingest";

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const { storedName, mime } = await saveUpload(buf, file.name, file.type, CHAT_MIMES);
  const [upload] = await db.insert(chatUploads).values({
    userId: session.user.id,
    storedName,
    filename: file.name,
    mime,
    size: buf.byteLength,
  }).returning();
  const settings = await getSettings(db);
  if (settings.autoLearnEnabled && KB_MIMES.includes(mime)) {
    const [knowledgeFile] = await db.insert(globalContextFiles).values({
      filename: file.name,
      mime,
      size: buf.byteLength,
      storagePath: storedName,
      createdBy: session.user.id,
      sourceType: "chat_upload",
      sourceUserId: session.user.id,
      sourceUploadId: upload.id,
    }).onConflictDoNothing({ target: globalContextFiles.sourceUploadId }).returning();
    if (knowledgeFile) startGlobalContextIngestion(db, knowledgeFile.id);
  }
  return Response.json({ url: `/api/files/${storedName}`, mediaType: mime, filename: file.name });
});

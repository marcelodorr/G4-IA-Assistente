import { saveUpload, CHAT_MIMES } from "@/lib/files/storage";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { db } from "@/lib/db";
import { chatUploads } from "@/lib/db/schema";

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const { storedName } = await saveUpload(buf, file.name, file.type, CHAT_MIMES);
  await db.insert(chatUploads).values({
    userId: session.user.id,
    storedName,
    filename: file.name,
    mime: file.type,
    size: buf.byteLength,
  });
  return Response.json({ url: `/api/files/${storedName}`, mediaType: file.type, filename: file.name });
});

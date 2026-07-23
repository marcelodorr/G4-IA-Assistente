import { saveUpload, CHAT_MIMES } from "@/lib/files/storage";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { db } from "@/lib/db";
import { chatUploads } from "@/lib/db/schema";
import { fetchExternalSite } from "@/lib/files/external-site";

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const isJson = req.headers.get("content-type")?.includes("application/json");
  let buf: Buffer;
  let filename: string;
  let storageFilename: string;
  let inputMime: string;
  if (isJson) {
    const body = await req.json() as { url?: unknown };
    if (typeof body.url !== "string") return Response.json({ error: "Informe o link do site" }, { status: 400 });
    const site = await fetchExternalSite(body.url);
    const parsed = new URL(site.url);
    buf = site.buffer;
    filename = `Site: ${parsed.hostname}${parsed.pathname}`.slice(0, 255);
    storageFilename = `site-${parsed.hostname}.html`;
    inputMime = site.mime;
  } else {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    buf = Buffer.from(await file.arrayBuffer());
    filename = file.name;
    storageFilename = file.name;
    inputMime = file.type;
  }
  const { storedName, mime } = await saveUpload(buf, storageFilename, inputMime, CHAT_MIMES);
  await db.insert(chatUploads).values({
    userId: session.user.id,
    storedName,
    filename,
    mime,
    size: buf.byteLength,
  });
  return Response.json({ url: `/api/files/${storedName}`, mediaType: mime, filename });
});

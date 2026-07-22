import { db } from "@/lib/db";
import { globalContextFiles } from "@/lib/db/schema";
import { KB_MIMES, saveUpload } from "@/lib/files/storage";
import { startGlobalContextIngestion } from "@/lib/rag/ingest";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { listGlobalContextFiles } from "@/lib/services/global-context";
import { fetchExternalSite } from "@/lib/files/external-site";

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
  const isJson = req.headers.get("content-type")?.includes("application/json");
  let buffer: Buffer;
  let filename: string;
  let inputMime: string;
  if (isJson) {
    const body = await req.json() as { url?: unknown };
    if (typeof body.url !== "string") return Response.json({ error: "Informe o link do site" }, { status: 400 });
    const site = await fetchExternalSite(body.url);
    buffer = site.buffer;
    filename = site.url;
    inputMime = site.mime;
  } else {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    buffer = Buffer.from(await file.arrayBuffer());
    filename = file.name;
    inputMime = file.type;
  }
  const storageFilename = /^https?:\/\//.test(filename) ? `site-${new URL(filename).hostname}.html` : filename;
  const { storedName, mime } = await saveUpload(buffer, storageFilename, inputMime, KB_MIMES);
  const [row] = await db.insert(globalContextFiles).values({
    filename,
    mime,
    size: buffer.byteLength,
    storagePath: storedName,
    createdBy: session.user.id,
    sourceType: "admin",
    sourceUserId: session.user.id,
  }).returning();
  startGlobalContextIngestion(db, row.id);
  return Response.json(row, { status: 202 });
});

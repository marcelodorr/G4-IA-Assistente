import { db } from "@/lib/db";
import { assistantFiles } from "@/lib/db/schema";
import { saveUpload, KB_MIMES } from "@/lib/files/storage";
import { startIngestion } from "@/lib/rag/ingest";
import { apiHandler, requireAdmin } from "@/lib/services/guards";
import { desc, eq } from "drizzle-orm";
import { fetchExternalSite } from "@/lib/files/external-site";

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
  const isJson = req.headers.get("content-type")?.includes("application/json");
  let buf: Buffer;
  let filename: string;
  let inputMime: string;
  if (isJson) {
    const body = await req.json() as { url?: unknown };
    if (typeof body.url !== "string") return Response.json({ error: "Informe o link do site" }, { status: 400 });
    const site = await fetchExternalSite(body.url);
    buf = site.buffer;
    filename = site.url;
    inputMime = site.mime;
  } else {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    buf = Buffer.from(await file.arrayBuffer());
    filename = file.name;
    inputMime = file.type;
  }
  const storageFilename = /^https?:\/\//.test(filename) ? `site-${new URL(filename).hostname}.html` : filename;
  const { storedName, mime } = await saveUpload(buf, storageFilename, inputMime, KB_MIMES);
  const [row] = await db.insert(assistantFiles).values({
    assistantId: id, filename, mime, size: buf.byteLength, storagePath: storedName,
  }).returning();
  startIngestion(db, row.id);
  return Response.json(row, { status: 202 });
});

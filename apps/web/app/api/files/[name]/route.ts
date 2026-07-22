import { readUpload } from "@/lib/files/storage";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { db } from "@/lib/db";
import { chatUploads } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const GET = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { name } = await params;
  const [upload] = await db.select().from(chatUploads).where(and(
    eq(chatUploads.storedName, name),
    eq(chatUploads.userId, session.user.id),
  ));
  if (!upload) return Response.json({ error: "Arquivo não encontrado" }, { status: 404 });
  const { buf, mime } = await readUpload(name);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" },
  });
});

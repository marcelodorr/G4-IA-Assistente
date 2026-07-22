import { readUpload } from "@/lib/files/storage";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { db } from "@/lib/db";
import { chatUploads, globalContextFiles } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const GET = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { name } = await params;
  const [upload] = await db.select().from(chatUploads).where(session.user.role === "admin"
    ? eq(chatUploads.storedName, name)
    : and(eq(chatUploads.storedName, name), eq(chatUploads.userId, session.user.id)));
  const globalFile = !upload && session.user.role === "admin"
    ? (await db.select({ id: globalContextFiles.id }).from(globalContextFiles).where(eq(globalContextFiles.storagePath, name)).limit(1))[0]
    : null;
  if (!upload && !globalFile) return Response.json({ error: "Arquivo não encontrado" }, { status: 404 });
  const { buf, mime } = await readUpload(name);
  const activeContent = mime === "text/html" || mime === "application/xhtml+xml" || mime === "image/svg+xml";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      ...(activeContent ? {
        "Content-Disposition": "attachment",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      } : {}),
    },
  });
});

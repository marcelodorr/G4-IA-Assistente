import { db } from "@/lib/db";
import { readArtifact } from "@/lib/files/storage";
import { getArtifact } from "@/lib/services/artifacts";
import { apiHandler, requireSession } from "@/lib/services/guards";

export const GET = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const artifact = await getArtifact(db, id);
  if (!artifact || (session.user.role !== "admin" && artifact.userId !== session.user.id)) {
    return Response.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
  const buffer = await readArtifact(artifact.storagePath);
  const encoded = encodeURIComponent(artifact.filename);
  return new Response(new Uint8Array(buffer), { headers: {
    "Content-Type": artifact.mime,
    "Content-Length": String(buffer.byteLength),
    "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
    "Cache-Control": "private, no-store",
  } });
});

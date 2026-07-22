import { db } from "@/lib/db";
import { getArtifact, getArtifactJob, processImageJob, retryImageJob } from "@/lib/services/artifacts";
import { apiHandler, requireSession } from "@/lib/services/guards";

const STALE_AFTER_MS = 6 * 60_000;

function canAccess(session: Awaited<ReturnType<typeof requireSession>>, userId: string) {
  return session.user.role === "admin" || session.user.id === userId;
}

export const GET = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const job = await getArtifactJob(db, id);
  if (!job || !canAccess(session, job.userId)) return Response.json({ error: "Geração não encontrada" }, { status: 404 });

  if (job.status === "pending") {
    void processImageJob(db, job.id).catch((error) => console.error("[artefato] falha ao retomar job pendente", error));
  }
  const artifact = job.artifactId ? await getArtifact(db, job.artifactId) : null;
  const stale = job.status === "processing" && Boolean(job.startedAt && Date.now() - job.startedAt.getTime() > STALE_AFTER_MS);
  return Response.json({
    id: job.id,
    status: job.status,
    stale,
    error: job.status === "error" ? job.error : null,
    filename: artifact?.filename ?? null,
    downloadUrl: artifact ? `/api/artifacts/${artifact.id}` : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const job = await getArtifactJob(db, id);
  if (!job || !canAccess(session, job.userId)) return Response.json({ error: "Geração não encontrada" }, { status: 404 });

  const stale = job.status === "processing" && Boolean(job.startedAt && Date.now() - job.startedAt.getTime() > STALE_AFTER_MS);
  if (job.status !== "error" && !stale) return Response.json({ error: "Esta geração não pode ser repetida agora" }, { status: 409 });
  await retryImageJob(db, id);
  return Response.json({ status: "pending" }, { status: 202 });
});

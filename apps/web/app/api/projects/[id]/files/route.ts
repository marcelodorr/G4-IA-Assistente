import { db } from "@/lib/db";
import { projectFiles } from "@/lib/db/schema";
import { KB_MIMES, saveUpload } from "@/lib/files/storage";
import { startProjectFileIngestion } from "@/lib/rag/ingest";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { getProject, isProjectFileKind, listProjectFiles } from "@/lib/services/projects";

export const GET = apiHandler(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const files = await listProjectFiles(db, id, session.user.id);
  if (!files) return Response.json({ error: "Projeto não encontrado" }, { status: 404 });
  return Response.json(files.map((file) => ({
    ...file,
    stale: (file.status === "pending" || file.status === "processing") && Date.now() - file.createdAt.getTime() > 10 * 60_000,
  })));
});

export const POST = apiHandler(async (req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  if (!(await getProject(db, id, session.user.id))) return Response.json({ error: "Projeto não encontrado" }, { status: 404 });
  const form = await req.formData();
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File)) return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  if (!isProjectFileKind(kind)) return Response.json({ error: "Tipo de conteúdo inválido" }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await saveUpload(buffer, file.name, file.type, KB_MIMES);
  const [row] = await db.insert(projectFiles).values({
    projectId: id,
    filename: file.name,
    mime: saved.mime,
    size: buffer.byteLength,
    storagePath: saved.storedName,
    kind,
  }).returning();
  startProjectFileIngestion(db, row.id);
  return Response.json(row, { status: 202 });
});

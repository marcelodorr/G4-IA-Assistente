import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { projectChunks, projectFiles, projects } from "@/lib/db/schema";

export const PROJECT_FILE_KINDS = ["document", "context", "skill"] as const;
export type ProjectFileKind = typeof PROJECT_FILE_KINDS[number];

export function isProjectFileKind(value: unknown): value is ProjectFileKind {
  return typeof value === "string" && PROJECT_FILE_KINDS.includes(value as ProjectFileKind);
}

export async function listProjects(db: Db, userId: string) {
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
}

export async function getProject(db: Db, id: string, userId: string) {
  return (await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1))[0] ?? null;
}

export async function createProject(db: Db, input: { userId: string; name: string; description?: string; context?: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Nome do projeto é obrigatório");
  if (name.length > 120) throw new Error("Nome do projeto deve ter no máximo 120 caracteres");
  const [row] = await db.insert(projects).values({
    userId: input.userId,
    name,
    description: input.description?.trim().slice(0, 500) || null,
    context: input.context?.trim().slice(0, 30_000) ?? "",
  }).returning();
  return row;
}

export async function updateProject(db: Db, id: string, userId: string, input: { name?: string; description?: string | null; context?: string }) {
  const current = await getProject(db, id, userId);
  if (!current) return null;
  const values: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Nome do projeto é obrigatório");
    if (name.length > 120) throw new Error("Nome do projeto deve ter no máximo 120 caracteres");
    values.name = name;
  }
  if (input.description !== undefined) values.description = input.description?.trim().slice(0, 500) || null;
  if (input.context !== undefined) values.context = input.context.trim().slice(0, 30_000);
  const [row] = await db.update(projects).set(values).where(and(eq(projects.id, id), eq(projects.userId, userId))).returning();
  return row ?? null;
}

export async function deleteProject(db: Db, id: string, userId: string) {
  const [row] = await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).returning();
  return row ?? null;
}

export async function listProjectFiles(db: Db, projectId: string, userId: string) {
  if (!(await getProject(db, projectId, userId))) return null;
  return db.select().from(projectFiles).where(eq(projectFiles.projectId, projectId)).orderBy(desc(projectFiles.createdAt));
}

export async function getProjectFile(db: Db, projectId: string, fileId: string, userId: string) {
  if (!(await getProject(db, projectId, userId))) return null;
  return (await db.select().from(projectFiles).where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId))).limit(1))[0] ?? null;
}

export async function getPersistentProjectFileContext(db: Db, projectId: string) {
  const files = await db.select({ id: projectFiles.id, filename: projectFiles.filename, kind: projectFiles.kind })
    .from(projectFiles).where(and(
      eq(projectFiles.projectId, projectId),
      eq(projectFiles.status, "ready"),
      inArray(projectFiles.kind, ["context", "skill"]),
    ));
  if (files.length === 0) return "";
  const fileById = new Map(files.map((file) => [file.id, file]));
  const rows = await db.select().from(projectChunks)
    .where(and(eq(projectChunks.projectId, projectId), inArray(projectChunks.fileId, files.map((file) => file.id))))
    .orderBy(asc(projectChunks.fileId), asc(projectChunks.chunkIndex));
  let total = 0;
  const sections: string[] = [];
  for (const row of rows) {
    if (total >= 30_000) break;
    const file = fileById.get(row.fileId)!;
    const remaining = 30_000 - total;
    const content = row.content.slice(0, remaining);
    sections.push(`[${file.kind === "skill" ? "SKILL" : "CONTEXTO"}: ${file.filename}]\n${content}`);
    total += content.length;
  }
  return sections.join("\n\n");
}

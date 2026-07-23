import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProject, listProjectFiles } from "@/lib/services/projects";
import { ProjectEditor } from "@/components/projects/project-editor";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await auth())!;
  const { id } = await params;
  const project = await getProject(db, id, session.user.id);
  if (!project) notFound();
  const files = await listProjectFiles(db, id, session.user.id) ?? [];
  return <main className="h-full overflow-y-auto"><div className="mx-auto max-w-5xl p-4 sm:p-6"><ProjectEditor project={project} initialFiles={files} /></div></main>;
}

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listProjects } from "@/lib/services/projects";
import { ProjectList } from "@/components/projects/project-list";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = (await auth())!;
  const projects = await listProjects(db, session.user.id);
  return <main className="h-full overflow-y-auto"><div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6"><ProjectList projects={projects} /></div></main>;
}

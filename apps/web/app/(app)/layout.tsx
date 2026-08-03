import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { settings, users } from "@/lib/db/schema";
import { isSetupCompleted } from "@/lib/services/setup";
import { listConversations } from "@/lib/services/conversations";
import { Sidebar } from "@/components/sidebar/sidebar";
import { listProjects } from "@/lib/services/projects";
import { getUserUsageSummary } from "@/lib/services/usage";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSetupCompleted(db))) redirect("/setup");
  const session = await auth();
  if (!session?.user) redirect("/login");
  // A sessão JWT continua válida após a desativação do usuário; confirma no banco
  // a cada navegação para não deixar um usuário desativado usar o app.
  const [user] = await db.select({ active: users.active, sessionVersion: users.sessionVersion, name: users.name, username: users.username, avatarStoragePath: users.avatarStoragePath, meetingsEnabled: users.meetingsEnabled }).from(users).where(eq(users.id, session.user.id));
  if (!user || !user.active || user.sessionVersion !== session.user.sessionVersion) redirect("/login");
  const [convs, projects, usage, systemSettings] = await Promise.all([
    listConversations(db, session.user.id),
    listProjects(db, session.user.id),
    getUserUsageSummary(db, session.user.id).catch((error) => {
      // Métricas são auxiliares: uma falha nelas nunca deve derrubar o chat.
      console.error("[layout] Falha ao carregar o uso individual", error);
      return null;
    }),
    db.select({ systemVersion: settings.systemVersion }).from(settings).where(eq(settings.id, 1)).then((rows) => rows[0]).catch((error) => {
      console.error("[layout] Falha ao carregar a versão do sistema", error);
      return null;
    }),
  ]);
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden">
      <Sidebar user={{ ...session.user, name: user.name, username: user.username, avatarUrl: user.avatarStoragePath ? "/api/profile/avatar" : null, meetingsEnabled: user.meetingsEnabled }} conversations={convs} projects={projects} usage={usage} systemVersion={systemSettings?.systemVersion ?? process.env.APP_VERSION ?? "0.1.0"} />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0">{children}</main>
    </div>
  );
}

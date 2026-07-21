import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isSetupCompleted } from "@/lib/services/setup";
import { listConversations } from "@/lib/services/conversations";
import { Sidebar } from "@/components/sidebar/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSetupCompleted(db))) redirect("/setup");
  const session = await auth();
  if (!session?.user) redirect("/login");
  // A sessão JWT continua válida após a desativação do usuário; confirma no banco
  // a cada navegação para não deixar um usuário desativado usar o app.
  const [user] = await db.select({ active: users.active }).from(users).where(eq(users.id, session.user.id));
  if (!user || !user.active) redirect("/login");
  const convs = await listConversations(db, session.user.id);
  return (
    <div className="flex h-screen">
      <Sidebar user={session.user} conversations={convs} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

import { db } from "@/lib/db";
import { listUsers } from "@/lib/services/users";
import { UsersTable } from "@/components/admin/users-table";
import { InviteDialog } from "@/components/admin/invite-dialog";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const users = await listUsers(db);
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-medium">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie os usuários com acesso ao G4 IA Assistente.</p>
        </div>
        <InviteDialog />
      </div>
      <UsersTable users={users} />
    </main>
  );
}

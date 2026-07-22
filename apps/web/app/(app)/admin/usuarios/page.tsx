import { db } from "@/lib/db";
import { listUsers } from "@/lib/services/users";
import { UsersTable } from "@/components/admin/users-table";
import { InviteDialog } from "@/components/admin/invite-dialog";
import { InvitesTable } from "@/components/admin/invites-table";
import { listInvites } from "@/lib/services/invites";
import { Button } from "@/components/ui/button";
import { listAssistants } from "@/lib/services/assistants";
import { getSettings } from "@/lib/services/settings";
import { SUPPORTED_MODELS } from "@/lib/ai/models";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const [users, invites, assistants, settings] = await Promise.all([listUsers(db), listInvites(db), listAssistants(db, {}), getSettings(db)]);
  const enabledModels = SUPPORTED_MODELS.filter((model) => !settings.disabledModels.includes(model));
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-medium">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie os usuários com acesso ao Sequor IA Assistente.</p>
        </div>
        <div className="flex gap-2"><form action="/api/users/export"><Button type="submit" variant="outline">Exportar CSV</Button></form><InviteDialog /></div>
      </div>
      <UsersTable users={users} assistants={assistants.map(({ id, name, active }) => ({ id, name, active }))} enabledModels={enabledModels} globalQuotas={{ daily: settings.dailyTokenLimit, weekly: settings.weeklyTokenLimit, monthly: settings.monthlyTokenLimit }} />
      <InvitesTable invites={invites} />
    </main>
  );
}

import { db } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function AdminConfiguracoesPage() {
  const settings = await getSettings(db);
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="font-heading text-xl font-medium">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie a chave, os modelos e os limites de consumo da IA.</p>
      </div>
      <SettingsForm settings={settings} />
    </main>
  );
}

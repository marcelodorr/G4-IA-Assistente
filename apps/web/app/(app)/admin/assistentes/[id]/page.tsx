import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAssistant } from "@/lib/services/assistants";
import { AssistantForm } from "@/components/admin/assistant-form";
import { AssistantFiles } from "@/components/admin/assistant-files";
import { listIntegrationAdmin } from "@/lib/services/integrations";
import { INTEGRATIONS } from "@/lib/integrations/catalog";

export const dynamic = "force-dynamic";

export default async function AdminAssistentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [assistente, integrations] = await Promise.all([getAssistant(db, id), listIntegrationAdmin(db)]);
  if (!assistente) notFound();
  const integrationOptions = integrations
    .filter((integration) => integration.active || integration.id === assistente.integrationProvider)
    .map(({ id, name, active }) => ({ id, name: active ? name : `${INTEGRATIONS[id].name} (inativa)` }));

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="font-heading text-xl font-medium">{assistente.name}</h1>
        <p className="text-sm text-muted-foreground">Edite as configurações do assistente.</p>
      </div>
      <AssistantForm assistant={assistente} integrations={integrationOptions} />
      <section className="space-y-3 border-t pt-6">
        <h2 className="font-heading text-base font-medium">Base de conhecimento</h2>
        <AssistantFiles assistantId={assistente.id} />
      </section>
    </main>
  );
}

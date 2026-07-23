import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listUserIntegrations } from "@/lib/services/integrations";
import { IntegrationWizardList } from "@/components/integrations/integration-wizard";

export const dynamic = "force-dynamic";

export default async function IntegracoesPage({ searchParams }: { searchParams: Promise<{ connected?: string; integrationError?: string }> }) {
  const session = await auth();
  const params = await searchParams;
  const integrations = await listUserIntegrations(db, session!.user.id);
  return <main className="h-full overflow-y-auto"><div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6"><div><h1 className="font-heading text-xl font-medium">Minhas integrações</h1><p className="text-sm text-muted-foreground">Veja o que cada plataforma permite, conecte sua conta passo a passo e use perguntas prontas no chat.</p></div><IntegrationWizardList initialIntegrations={integrations} notice={{ success: params.connected, error: params.integrationError }} /></div></main>;
}

import { db } from "@/lib/db";
import { listIntegrationAdmin } from "@/lib/services/integrations";
import { listUsers } from "@/lib/services/users";
import { IntegrationsAdmin } from "@/components/admin/integrations-admin";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AdminIntegracoesPage() {
  const [integrations, users] = await Promise.all([listIntegrationAdmin(db), listUsers(db)]);
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const appUrl = (process.env.APP_URL ?? `${protocol}://${host}`).replace(/\/$/, "");
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6"><div><h1 className="font-heading text-xl font-medium">Integrações</h1><p className="text-sm text-muted-foreground">Configure os aplicativos externos e escolha quais usuários podem conectar suas próprias contas.</p></div><IntegrationsAdmin integrations={integrations} users={users.map(({ id, name, email, active }) => ({ id, name, email, active }))} appUrl={appUrl} /></main>;
}

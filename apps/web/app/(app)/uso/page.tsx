import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserUsageSummary } from "@/lib/services/usage";
import { UserUsageDashboard } from "@/components/usage/user-usage-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function UserUsagePage() {
  const session = await auth();
  const usage = await getUserUsageSummary(db, session!.user.id).catch((error) => {
    console.error("[uso] Falha ao carregar o uso individual", error);
    return null;
  });
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div><h1 className="font-heading text-xl font-medium">Meu uso de IA</h1><p className="text-sm text-muted-foreground">Acompanhe seus tokens disponíveis e o consumo de cada interação em tempo real.</p></div>
        {usage ? <UserUsageDashboard initialUsage={usage} /> : (
          <Card><CardHeader><CardTitle>Não foi possível carregar seu uso agora</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">O chat continua disponível. Aguarde alguns segundos e atualize esta página; se o problema persistir, o administrador deve verificar as migrations no log do Dokploy.</CardContent></Card>
        )}
      </div>
    </main>
  );
}

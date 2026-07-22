import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { listAssistants } from "@/lib/services/assistants";
import { assistantFiles } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AssistantForm } from "@/components/admin/assistant-form";
import { AGENT_TYPE_LABELS } from "@/lib/ai/agent-types";

export const dynamic = "force-dynamic";

export default async function AdminAssistentesPage() {
  const assistentes = await listAssistants(db, {});
  const contagens = await db
    .select({ assistantId: assistantFiles.assistantId, total: sql<number>`count(*)::int` })
    .from(assistantFiles)
    .groupBy(assistantFiles.assistantId);
  const contagemPorAssistente = new Map(contagens.map((c) => [c.assistantId, c.total]));

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-medium">Assistentes</h1>
          <p className="text-sm text-muted-foreground">Crie e configure os assistentes de IA disponíveis para os usuários.</p>
        </div>
        <AssistantForm />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {assistentes.map((assistente) => (
          <Link key={assistente.id} href={`/admin/assistentes/${assistente.id}`}>
            <Card className="h-full transition-colors hover:bg-accent/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{assistente.name}</CardTitle>
                  <Badge variant={assistente.active ? "default" : "destructive"}>
                    {assistente.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <CardDescription>{assistente.description || "Sem descrição"}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {AGENT_TYPE_LABELS[assistente.agentType]} · {contagemPorAssistente.get(assistente.id) ?? 0} arquivo(s) na base
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {assistentes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum assistente cadastrado ainda.</p>
        )}
      </div>
    </main>
  );
}

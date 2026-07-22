import { db } from "@/lib/db";
import { getGlobalContext, listGlobalContextFiles } from "@/lib/services/global-context";
import { GlobalContextForm } from "@/components/admin/global-context-form";
import { getSettings } from "@/lib/services/settings";
import { listCorporateMemories } from "@/lib/services/corporate-memory";

export const dynamic = "force-dynamic";

export default async function GlobalContextPage() {
  const [content, rows, memories, settings] = await Promise.all([getGlobalContext(db), listGlobalContextFiles(db), listCorporateMemories(db), getSettings(db)]);
  const files = rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    storagePath: row.storagePath,
    size: row.size,
    status: row.status,
    error: row.error,
    sourceType: row.sourceType,
    sourceUserName: row.sourceUserName,
    sourceUserEmail: row.sourceUserEmail,
    createdAt: row.createdAt.toISOString(),
    stale: false,
  }));
  const memoryRows = memories.map((memory) => ({ ...memory, createdAt: memory.createdAt.toISOString() }));
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-heading text-xl font-medium">Contexto geral</h1>
        <p className="text-sm text-muted-foreground">Diretrizes e conhecimento corporativo aplicados a todas as conversas, assistentes e futuras integrações.</p>
      </div>
      <GlobalContextForm initialContent={content} initialFiles={files} initialMemories={memoryRows} initialAutoLearn={settings.autoLearnEnabled} />
    </main>
  );
}

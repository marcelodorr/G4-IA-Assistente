import { db } from "@/lib/db";
import { getGlobalContext, listGlobalContextFiles } from "@/lib/services/global-context";
import { GlobalContextForm } from "@/components/admin/global-context-form";

export const dynamic = "force-dynamic";

export default async function GlobalContextPage() {
  const [content, rows] = await Promise.all([getGlobalContext(db), listGlobalContextFiles(db)]);
  const files = rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    size: row.size,
    status: row.status,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    stale: false,
  }));
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-heading text-xl font-medium">Contexto geral</h1>
        <p className="text-sm text-muted-foreground">Diretrizes e conhecimento corporativo aplicados a todas as conversas, assistentes e futuras integrações.</p>
      </div>
      <GlobalContextForm initialContent={content} initialFiles={files} />
    </main>
  );
}

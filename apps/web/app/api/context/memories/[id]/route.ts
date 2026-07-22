import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { corporateMemories } from "@/lib/db/schema";
import { deleteCorporateMemory, processCorporateMemory } from "@/lib/services/corporate-memory";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

export const POST = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const [memory] = await db.select().from(corporateMemories).where(eq(corporateMemories.id, id));
  if (!memory) return Response.json({ error: "Memória não encontrada" }, { status: 404 });
  await processCorporateMemory(db, id);
  return new Response(null, { status: 204 });
});

export const DELETE = apiHandler(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await deleteCorporateMemory(db, id);
  return new Response(null, { status: 204 });
});

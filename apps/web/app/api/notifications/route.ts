import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { listSystemErrors, logSystemError, markSystemErrorsRead } from "@/lib/services/system-errors";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  const notifications = await listSystemErrors(db, { id: session.user.id, role: session.user.role });
  return Response.json({ notifications, unread: notifications.filter((item) => !item.read).length }, { headers: { "Cache-Control": "no-store" } });
});

export const PATCH = apiHandler(async (req) => {
  const session = await requireSession();
  const body = await req.json().catch(() => ({})) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : undefined;
  await markSystemErrorsRead(db, { id: session.user.id, role: session.user.role }, id);
  return new Response(null, { status: 204 });
});

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const body = await req.json().catch(() => ({})) as { message?: unknown; stack?: unknown; path?: unknown };
  const message = typeof body.message === "string" ? body.message.slice(0, 1_000) : "Erro inesperado na interface";
  const stack = typeof body.stack === "string" ? body.stack.slice(0, 5_000) : "";
  await logSystemError(db, {
    error: new Error(`${message}\n${stack}`),
    userId: session.user.id,
    source: "Interface do sistema",
    path: typeof body.path === "string" ? body.path : null,
    message: "Uma tela encontrou um problema e não conseguiu terminar a ação.",
  });
  return new Response(null, { status: 204 });
});

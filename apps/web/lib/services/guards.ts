import { auth } from "@/lib/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw Response.json({ error: "Não autenticado" }, { status: 401 });
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") throw Response.json({ error: "Apenas administradores" }, { status: 403 });
  return session;
}

export function apiHandler(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    try { return await fn(req, ctx); }
    catch (e) {
      if (e instanceof Response) return e;
      const msg = e instanceof Error ? e.message : "Erro interno";
      return Response.json({ error: msg }, { status: 400 });
    }
  };
}

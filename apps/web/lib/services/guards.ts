import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw Response.json({ error: "Não autenticado" }, { status: 401 });
  // A sessão JWT continua válida mesmo após o usuário ser desativado; checa o
  // estado atual no banco a cada request de API para revogar o acesso na hora.
  const [user] = await db.select({ active: users.active }).from(users).where(eq(users.id, session.user.id));
  if (!user || !user.active) throw Response.json({ error: "Conta desativada" }, { status: 403 });
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") throw Response.json({ error: "Apenas administradores" }, { status: 403 });
  return session;
}

type RouteContext = { params: Promise<Record<string, string>> };

export function apiHandler(fn: (req: Request, ctx: RouteContext) => Promise<Response>) {
  return async (req: Request, ctx: RouteContext) => {
    try { return await fn(req, ctx); }
    catch (e) {
      if (e instanceof Response) return e;
      // Só expõe a mensagem para erros de domínio lançados por nós (`new Error(...)` puro).
      // Erros de bibliotecas (ex.: PostgresError) não devem vazar detalhes internos.
      if (e instanceof Error && e.constructor === Error) {
        return Response.json({ error: e.message }, { status: 400 });
      }
      console.error(e);
      return Response.json({ error: "Erro interno" }, { status: 500 });
    }
  };
}

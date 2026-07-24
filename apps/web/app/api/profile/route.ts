import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { getOwnProfile, updateOwnProfile } from "@/lib/services/profile";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  return Response.json(await getOwnProfile(db, session.user.id), { headers: { "Cache-Control": "no-store" } });
});

export const PATCH = apiHandler(async (req) => {
  const session = await requireSession();
  const body = await req.json().catch(() => ({})) as { name?: unknown; username?: unknown };
  if (typeof body.name !== "string") throw new Error("Nome de exibição é obrigatório");
  if (body.username !== null && body.username !== undefined && typeof body.username !== "string") throw new Error("Nome de usuário inválido");
  const username = typeof body.username === "string" ? body.username : null;
  return Response.json(await updateOwnProfile(db, session.user.id, { name: body.name, username }));
});

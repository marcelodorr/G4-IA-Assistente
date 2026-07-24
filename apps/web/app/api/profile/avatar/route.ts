import { unlink } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { readUpload, saveUpload, uploadsDir } from "@/lib/files/storage";

const AVATAR_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  const [user] = await db.select({ path: users.avatarStoragePath }).from(users).where(eq(users.id, session.user.id));
  if (!user?.path) return new Response(null, { status: 404 });
  const file = await readUpload(user.path);
  return new Response(file.buf, { headers: { "Content-Type": file.mime, "Cache-Control": "private, max-age=300" } });
});

export const POST = apiHandler(async (req) => {
  const session = await requireSession();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Selecione uma foto");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("A foto deve ter no máximo 5 MB");
  const [current] = await db.select({ path: users.avatarStoragePath }).from(users).where(eq(users.id, session.user.id));
  const saved = await saveUpload(Buffer.from(await file.arrayBuffer()), file.name, file.type, AVATAR_MIMES);
  await db.update(users).set({ avatarStoragePath: saved.storedName }).where(eq(users.id, session.user.id));
  if (current?.path) await unlink(path.join(uploadsDir(), current.path)).catch(() => {});
  return Response.json({ avatarUrl: `/api/profile/avatar?v=${Date.now()}` });
});

export const DELETE = apiHandler(async () => {
  const session = await requireSession();
  const [current] = await db.select({ path: users.avatarStoragePath }).from(users).where(eq(users.id, session.user.id));
  await db.update(users).set({ avatarStoragePath: null }).where(eq(users.id, session.user.id));
  if (current?.path) await unlink(path.join(uploadsDir(), current.path)).catch(() => {});
  return new Response(null, { status: 204 });
});

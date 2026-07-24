import { db } from "@/lib/db";
import { apiHandler, requireSession } from "@/lib/services/guards";
import { getOwnProfile, TONES, TRAITS, updatePreferences, type Tone, type Trait } from "@/lib/services/profile";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const session = await requireSession();
  return Response.json((await getOwnProfile(db, session.user.id)).preferences, { headers: { "Cache-Control": "no-store" } });
});

export const PATCH = apiHandler(async (req) => {
  const session = await requireSession();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (typeof body.tone !== "string" || !TONES.includes(body.tone as Tone)) throw new Error("Estilo de resposta inválido");
  const traits = Array.isArray(body.traits) ? body.traits.filter((item): item is Trait => typeof item === "string" && TRAITS.includes(item as Trait)) : [];
  const text = (key: string) => typeof body[key] === "string" ? body[key] as string : "";
  const flag = (key: string, fallback = false) => typeof body[key] === "boolean" ? body[key] as boolean : fallback;
  return Response.json(await updatePreferences(db, session.user.id, {
    tone: body.tone as Tone,
    traits,
    useHeadings: flag("useHeadings", true),
    useEmojis: flag("useEmojis"),
    conciseResponses: flag("conciseResponses"),
    suggestedPrompts: flag("suggestedPrompts", true),
    customInstructions: text("customInstructions"),
    aboutYou: text("aboutYou"),
    jobTitle: text("jobTitle"),
    moreAboutYou: text("moreAboutYou"),
    memoryEnabled: flag("memoryEnabled", true),
    webSearchEnabled: flag("webSearchEnabled"),
  }));
});

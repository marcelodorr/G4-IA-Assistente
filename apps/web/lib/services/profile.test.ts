import { beforeEach, describe, expect, it } from "vitest";
import { users } from "@/lib/db/schema";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { buildPersonalContext, getOwnProfile, updateOwnProfile, updatePreferences } from "./profile";

describe.skipIf(!process.env.TEST_DATABASE_URL)("profile", () => {
  beforeEach(truncateAll);

  it("salva perfil e aplica preferências ao contexto pessoal", async () => {
    const db = await getTestDb();
    const [user] = await db.insert(users).values({ name: "Pessoa", email: "perfil@sequor.com.br", passwordHash: "x" }).returning();
    await updateOwnProfile(db, user.id, { name: "Marcelo", username: "Marcelo.Dorr" });
    await updatePreferences(db, user.id, {
      tone: "direct", traits: ["welcoming"], useHeadings: true, useEmojis: false,
      conciseResponses: true, suggestedPrompts: true, customInstructions: "Comece pelo resumo.",
      aboutYou: "Atua com tecnologia.", jobTitle: "Diretor", moreAboutYou: "Valoriza clareza.",
      memoryEnabled: true, webSearchEnabled: true,
    });
    const profile = await getOwnProfile(db, user.id);
    expect(profile.username).toBe("marcelo.dorr");
    expect(profile.preferences.webSearchEnabled).toBe(true);
    expect(buildPersonalContext(profile)).toContain("Cargo: Diretor");
    expect(buildPersonalContext(profile)).toContain("Comece pelo resumo.");
  });
});

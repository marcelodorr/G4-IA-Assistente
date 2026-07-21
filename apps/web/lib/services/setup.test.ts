import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { completeSetup, isSetupCompleted } from "./setup";
import { getOpenAIKey } from "./settings";
import { verifyCredentials } from "@/lib/auth/verify-credentials";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const input = { name: "Admin", email: "Admin@G4.com", password: "senha123", openaiKey: "sk-ok", defaultModel: "gpt-5-mini" };
const okKey = async () => true;

describe.skipIf(!process.env.TEST_DATABASE_URL)("setup", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = "c".repeat(64);
    await truncateAll();
  });

  it("cria admin, salva chave e marca concluído", async () => {
    const db = await getTestDb();
    await completeSetup(db, input, { validateKey: okKey });
    expect(await isSetupCompleted(db)).toBe(true);
    expect(await getOpenAIKey(db)).toBe("sk-ok");
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@g4.com"));
    expect(admin.role).toBe("admin");
    // senha funciona no login
    expect(await verifyCredentials("admin@g4.com", "senha123", async () => admin)).not.toBeNull();
  });

  it("recusa segunda execução", async () => {
    const db = await getTestDb();
    await completeSetup(db, input, { validateKey: okKey });
    await expect(completeSetup(db, input, { validateKey: okKey })).rejects.toThrow(/já configurado/);
  });

  it("recusa chave OpenAI inválida", async () => {
    const db = await getTestDb();
    await expect(completeSetup(db, input, { validateKey: async () => false })).rejects.toThrow(/chave/i);
    expect(await isSetupCompleted(db)).toBe(false);
  });

  it("valida senha mínima de 8 caracteres", async () => {
    const db = await getTestDb();
    await expect(completeSetup(db, { ...input, password: "1234567" }, { validateKey: okKey })).rejects.toThrow(/senha/i);
  });
});

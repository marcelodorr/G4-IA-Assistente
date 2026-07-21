import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { getSettings, saveOpenAIKey, setDefaultModel, markSetupCompleted } from "./settings";
import type { Db } from "@/lib/db";

export async function isSetupCompleted(db: Db) {
  return (await getSettings(db)).setupCompleted;
}

export async function validateOpenAIKey(key: string): Promise<boolean> {
  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
  const res = await fetch(`${base.replace(/\/v1$/, "")}/v1/models`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  return res.ok;
}

type SetupInput = { name: string; email: string; password: string; openaiKey: string; defaultModel: string };

export async function completeSetup(db: Db, input: SetupInput, deps = { validateKey: validateOpenAIKey }) {
  if (await isSetupCompleted(db)) throw new Error("Sistema já configurado");
  if (input.password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres");
  if (!input.name.trim() || !input.email.includes("@")) throw new Error("Nome ou e-mail inválido");
  if (!(await deps.validateKey(input.openaiKey.trim()))) throw new Error("Chave OpenAI inválida — verifique e tente novamente");

  await db.insert(users).values({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: await hashPassword(input.password),
    role: "admin",
  });
  await saveOpenAIKey(db, input.openaiKey);
  await setDefaultModel(db, input.defaultModel);
  await markSetupCompleted(db);
}

import { createOpenAI } from "@ai-sdk/openai";
import { getOpenAIKey } from "@/lib/services/settings";
import type { Db } from "@/lib/db";

export async function getProvider(db: Db) {
  const apiKey = await getOpenAIKey(db);
  return createOpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL });
}

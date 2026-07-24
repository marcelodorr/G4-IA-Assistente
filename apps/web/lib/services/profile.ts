import { eq, ne, and } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { userPreferences, users } from "@/lib/db/schema";

export const TONES = ["balanced", "professional", "friendly", "direct", "creative"] as const;
export const TRAITS = ["welcoming", "enthusiastic", "analytical", "patient", "objective"] as const;
export type Tone = typeof TONES[number];
export type Trait = typeof TRAITS[number];

const DEFAULT_PREFERENCES = {
  tone: "balanced" as Tone,
  traits: [] as Trait[],
  useHeadings: true,
  useEmojis: false,
  conciseResponses: false,
  suggestedPrompts: true,
  customInstructions: "",
  aboutYou: "",
  jobTitle: "",
  moreAboutYou: "",
  memoryEnabled: true,
  webSearchEnabled: false,
};

function normalizeTraits(value: unknown): Trait[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is Trait => typeof item === "string" && TRAITS.includes(item as Trait)))];
}

export async function getOwnProfile(db: Db, userId: string) {
  const [profile, preference] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, username: users.username, avatarStoragePath: users.avatarStoragePath }).from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1),
  ]);
  if (!profile[0]) throw new Error("Usuário não encontrado");
  return {
    ...profile[0],
    avatarUrl: profile[0].avatarStoragePath ? "/api/profile/avatar" : null,
    preferences: preference[0] ? { ...preference[0], traits: normalizeTraits(preference[0].traits) } : { userId, ...DEFAULT_PREFERENCES, updatedAt: new Date() },
  };
}

export async function updateOwnProfile(db: Db, userId: string, input: { name: string; username: string | null }) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 100) throw new Error("O nome de exibição deve ter entre 2 e 100 caracteres");
  const username = input.username?.trim().toLowerCase() || null;
  if (username && !/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("O nome de usuário deve ter de 3 a 30 caracteres e usar somente letras, números, ponto, hífen ou sublinhado");
  if (username) {
    const existing = await db.select({ id: users.id }).from(users).where(and(eq(users.username, username), ne(users.id, userId))).limit(1);
    if (existing[0]) throw new Error("Este nome de usuário já está em uso");
  }
  const [row] = await db.update(users).set({ name, username }).where(eq(users.id, userId)).returning({ id: users.id, name: users.name, email: users.email, username: users.username });
  if (!row) throw new Error("Usuário não encontrado");
  return row;
}

export async function updatePreferences(db: Db, userId: string, input: {
  tone: Tone; traits: Trait[]; useHeadings: boolean; useEmojis: boolean; conciseResponses: boolean;
  suggestedPrompts: boolean; customInstructions: string; aboutYou: string; jobTitle: string;
  moreAboutYou: string; memoryEnabled: boolean; webSearchEnabled: boolean;
}) {
  if (!TONES.includes(input.tone)) throw new Error("Estilo de resposta inválido");
  const traits = normalizeTraits(input.traits);
  const values = {
    tone: input.tone,
    traits,
    useHeadings: Boolean(input.useHeadings),
    useEmojis: Boolean(input.useEmojis),
    conciseResponses: Boolean(input.conciseResponses),
    suggestedPrompts: Boolean(input.suggestedPrompts),
    customInstructions: input.customInstructions.trim().slice(0, 10_000),
    aboutYou: input.aboutYou.trim().slice(0, 5_000),
    jobTitle: input.jobTitle.trim().slice(0, 200),
    moreAboutYou: input.moreAboutYou.trim().slice(0, 5_000),
    memoryEnabled: Boolean(input.memoryEnabled),
    webSearchEnabled: Boolean(input.webSearchEnabled),
    updatedAt: new Date(),
  };
  const [row] = await db.insert(userPreferences).values({ userId, ...values }).onConflictDoUpdate({ target: userPreferences.userId, set: values }).returning();
  return { ...row, traits: normalizeTraits(row.traits) };
}

export function buildPersonalContext(profile: Awaited<ReturnType<typeof getOwnProfile>>) {
  const p = profile.preferences;
  const toneLabels: Record<Tone, string> = { balanced: "equilibrado", professional: "profissional", friendly: "amigável", direct: "direto", creative: "criativo" };
  const traitLabels: Record<Trait, string> = { welcoming: "acolhedor", enthusiastic: "entusiasmado", analytical: "analítico", patient: "paciente", objective: "objetivo" };
  const lines = [
    `Nome de exibição: ${profile.name}.`,
    profile.username ? `Nome de usuário: @${profile.username}.` : "",
    p.jobTitle ? `Cargo: ${p.jobTitle}.` : "",
    p.aboutYou ? `Sobre o usuário: ${p.aboutYou}` : "",
    p.moreAboutYou ? `Interesses, valores e preferências: ${p.moreAboutYou}` : "",
    `Estilo básico: ${toneLabels[p.tone]}.`,
    p.traits.length ? `Características desejadas: ${p.traits.map((trait) => traitLabels[trait]).join(", ")}.` : "",
    p.useHeadings ? "Use listas e cabeçalhos quando melhorarem a leitura." : "Evite excesso de listas e cabeçalhos.",
    p.useEmojis ? "Pode usar emojis com moderação." : "Não use emojis, salvo se o usuário pedir.",
    p.conciseResponses ? "Priorize respostas rápidas e concisas." : "Forneça o nível de detalhe necessário para resolver bem a solicitação.",
    p.memoryEnabled ? "A memória pessoal está ativa: considere os dados fornecidos acima em todas as conversas." : "A memória pessoal está desativada: não infira nem retenha novos dados pessoais além desta conversa.",
    p.customInstructions ? `Instruções personalizadas: ${p.customInstructions}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

import { and, desc, eq, gte, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { systemErrorReads, systemErrors, users } from "@/lib/db/schema";
import { getPublicError } from "@/lib/errors/public-error";

const TITLES: Record<string, string> = {
  STORAGE_FULL: "O espaço para arquivos acabou",
  OPENAI_AUTH: "A conexão com a OpenAI precisa de atenção",
  OPENAI_RATE_LIMIT: "A OpenAI está temporariamente ocupada",
  OPENAI_QUOTA: "A conta da OpenAI atingiu o limite",
  MODEL_UNAVAILABLE: "O modelo de IA não está disponível",
  UPSTREAM_TIMEOUT: "Um serviço demorou demais para responder",
  SERVICE_UNAVAILABLE: "Um serviço necessário está fora do ar",
  INTERNAL_ERROR: "Algo não funcionou como esperado",
};

const SUGGESTIONS: Record<string, string> = {
  STORAGE_FULL: "Peça ao administrador para liberar espaço ou aumentar o volume de armazenamento.",
  OPENAI_AUTH: "O administrador deve atualizar a chave da OpenAI em Configurações.",
  OPENAI_RATE_LIMIT: "Aguarde alguns minutos e tente novamente.",
  OPENAI_QUOTA: "O administrador deve verificar os créditos e limites da conta OpenAI.",
  MODEL_UNAVAILABLE: "Escolha outro modelo ou peça ao administrador para revisar os modelos liberados.",
  UPSTREAM_TIMEOUT: "Tente novamente. Se continuar acontecendo, informe o administrador.",
  SERVICE_UNAVAILABLE: "Aguarde alguns minutos e tente novamente. O administrador pode consultar Saúde do sistema.",
  INTERNAL_ERROR: "Tente novamente. Se o erro se repetir, o administrador encontrará os detalhes técnicos nesta notificação.",
};

function sanitizeTechnical(value: string) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/gi, "postgresql://***:***@")
    .replace(/\bsk-[a-z0-9_-]{12,}\b/gi, "sk-***")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer ***")
    .slice(0, 6_000);
}

function technicalDetails(error: unknown) {
  if (error instanceof Error) return sanitizeTechnical([error.name, error.message, error.stack].filter(Boolean).join("\n"));
  return sanitizeTechnical(String(error ?? "Erro sem detalhes técnicos"));
}

export async function logSystemError(db: Db, input: {
  error: unknown;
  userId?: string | null;
  source: string;
  path?: string | null;
  title?: string;
  message?: string;
  suggestion?: string;
  severity?: "warning" | "error";
}) {
  try {
    const publicError = getPublicError(input.error);
    const cutoff = new Date(Date.now() - 60_000);
    const sameRecipient = input.userId ? eq(systemErrors.userId, input.userId) : isNull(systemErrors.userId);
    const samePath = input.path ? eq(systemErrors.path, input.path.slice(0, 500)) : isNull(systemErrors.path);
    const duplicate = await db.select({ id: systemErrors.id }).from(systemErrors).where(and(
      sameRecipient,
      samePath,
      eq(systemErrors.source, input.source.slice(0, 120)),
      eq(systemErrors.code, publicError.code),
      gte(systemErrors.createdAt, cutoff),
    )).limit(1);
    if (duplicate.length > 0) return duplicate[0].id;

    const [row] = await db.insert(systemErrors).values({
      userId: input.userId ?? null,
      source: input.source.slice(0, 120),
      path: input.path?.slice(0, 500) ?? null,
      title: (input.title ?? TITLES[publicError.code] ?? TITLES.INTERNAL_ERROR).slice(0, 200),
      message: (input.message ?? publicError.message).slice(0, 1_000),
      suggestion: (input.suggestion ?? SUGGESTIONS[publicError.code] ?? SUGGESTIONS.INTERNAL_ERROR).slice(0, 1_000),
      code: publicError.code.slice(0, 100),
      severity: input.severity ?? "error",
      technicalDetails: technicalDetails(input.error),
    }).returning({ id: systemErrors.id });
    return row?.id ?? null;
  } catch (loggingError) {
    // O registro de falhas nunca pode causar uma segunda falha na operação original.
    console.error("[notificações] Não foi possível registrar o erro", loggingError);
    return null;
  }
}

export async function listSystemErrors(db: Db, viewer: { id: string; role: "admin" | "member" }) {
  const rows = await db.select({
    id: systemErrors.id,
    userId: systemErrors.userId,
    userName: users.name,
    userEmail: users.email,
    source: systemErrors.source,
    path: systemErrors.path,
    title: systemErrors.title,
    message: systemErrors.message,
    suggestion: systemErrors.suggestion,
    code: systemErrors.code,
    severity: systemErrors.severity,
    technicalDetails: systemErrors.technicalDetails,
    createdAt: systemErrors.createdAt,
    readAt: systemErrorReads.readAt,
  }).from(systemErrors)
    .leftJoin(users, eq(users.id, systemErrors.userId))
    .leftJoin(systemErrorReads, and(eq(systemErrorReads.errorId, systemErrors.id), eq(systemErrorReads.userId, viewer.id)))
    .where(viewer.role === "admin" ? undefined : eq(systemErrors.userId, viewer.id))
    .orderBy(desc(systemErrors.createdAt))
    .limit(50);

  return rows.map((row) => ({
    ...row,
    technicalDetails: viewer.role === "admin" ? row.technicalDetails : null,
    createdAt: row.createdAt.toISOString(),
    read: row.readAt != null,
    readAt: undefined,
  }));
}

export async function markSystemErrorsRead(db: Db, viewer: { id: string; role: "admin" | "member" }, errorId?: string) {
  const visible = await db.select({ id: systemErrors.id }).from(systemErrors)
    .where(and(
      errorId ? eq(systemErrors.id, errorId) : undefined,
      viewer.role === "admin" ? undefined : eq(systemErrors.userId, viewer.id),
    )).orderBy(desc(systemErrors.createdAt)).limit(errorId ? 1 : 50);
  if (visible.length === 0) return;
  await db.insert(systemErrorReads).values(visible.map((row) => ({ errorId: row.id, userId: viewer.id }))).onConflictDoNothing();
}

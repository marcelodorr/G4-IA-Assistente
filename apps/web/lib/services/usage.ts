import { and, eq, gte, sql } from "drizzle-orm";
import { aiUsage, settings, users } from "@/lib/db/schema";
import { estimateCostMicros } from "@/lib/ai/models";
import type { Db, Tx } from "@/lib/db";

function periodStarts(now = new Date()) {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { day, month };
}

const chargedTokens = sql<number>`greatest(${aiUsage.inputTokens} + ${aiUsage.outputTokens}, ${aiUsage.reservedTokens})`;

async function sumUsage(db: Db | Tx, since: Date, userId?: string) {
  const where = userId
    ? and(gte(aiUsage.createdAt, since), eq(aiUsage.userId, userId))
    : gte(aiUsage.createdAt, since);
  const [row] = await db.select({ total: sql<number>`coalesce(sum(${chargedTokens}), 0)` }).from(aiUsage).where(where);
  return Number(row?.total ?? 0);
}

export async function reserveChatUsage(db: Db, input: {
  userId: string;
  conversationId: string;
  messageId: string;
  model: string;
  estimatedInputTokens: number;
  maxOutputTokens: number;
}) {
  return db.transaction(async (tx) => {
    // Serializa reservas de cota da instalação e deste usuário. Assim duas
    // chamadas simultâneas não passam pela mesma cota ao mesmo tempo.
    await tx.execute(sql`select pg_advisory_xact_lock(872341::bigint)`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId})::bigint)`);

    const [config] = await tx.select().from(settings).where(eq(settings.id, 1));
    const [user] = await tx.select().from(users).where(eq(users.id, input.userId));
    if (!user) throw new Error("Usuário não encontrado");
    const { day, month } = periodStarts();
    const reservation = input.estimatedInputTokens + input.maxOutputTokens;
    const dayAll = await sumUsage(tx, day);
    const monthAll = await sumUsage(tx, month);
    const dayUser = await sumUsage(tx, day, input.userId);
    const monthUser = await sumUsage(tx, month, input.userId);
    const globalDaily = config?.dailyTokenLimit ?? 200_000;
    const globalMonthly = config?.monthlyTokenLimit ?? 4_000_000;
    const userDaily = user.dailyTokenLimit ?? globalDaily;
    const userMonthly = user.monthlyTokenLimit ?? globalMonthly;
    if (dayAll + reservation > globalDaily) throw Response.json({ error: "Cota diária da instalação atingida" }, { status: 429 });
    if (monthAll + reservation > globalMonthly) throw Response.json({ error: "Cota mensal da instalação atingida" }, { status: 429 });
    if (dayUser + reservation > userDaily) throw Response.json({ error: "Sua cota diária de IA foi atingida" }, { status: 429 });
    if (monthUser + reservation > userMonthly) throw Response.json({ error: "Sua cota mensal de IA foi atingida" }, { status: 429 });

    const [row] = await tx.insert(aiUsage).values({
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      kind: "chat",
      model: input.model,
      reservedTokens: reservation,
    }).returning();
    return row;
  });
}

export async function finishUsage(db: Db, id: string, input: {
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  success: boolean;
  error?: string | null;
}) {
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const [row] = await db.select({ model: aiUsage.model }).from(aiUsage).where(eq(aiUsage.id, id));
  await db.update(aiUsage).set({
    inputTokens,
    outputTokens,
    reservedTokens: 0,
    estimatedCostMicros: estimateCostMicros(row?.model ?? "", inputTokens, outputTokens),
    durationMs: input.durationMs,
    success: input.success,
    error: input.error?.slice(0, 500) ?? null,
    finishedAt: new Date(),
  }).where(eq(aiUsage.id, id));
}

export async function recordEmbeddingUsage(db: Db, input: {
  userId: string;
  conversationId?: string | null;
  tokens: number;
  durationMs: number;
  success: boolean;
}) {
  await db.insert(aiUsage).values({
    userId: input.userId,
    conversationId: input.conversationId,
    kind: "embedding",
    model: "text-embedding-3-small",
    inputTokens: Number.isFinite(input.tokens) ? input.tokens : 0,
    estimatedCostMicros: Math.round((Number.isFinite(input.tokens) ? input.tokens : 0) * 0.02),
    durationMs: input.durationMs,
    success: input.success,
    finishedAt: new Date(),
  });
}

export async function recordCompletedChatUsage(db: Db, input: {
  userId: string;
  conversationId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}) {
  await db.insert(aiUsage).values({
    userId: input.userId,
    conversationId: input.conversationId,
    kind: "chat",
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimatedCostMicros: estimateCostMicros(input.model, input.inputTokens, input.outputTokens),
    durationMs: input.durationMs,
    success: true,
    finishedAt: new Date(),
  });
}

export async function getUsageDashboard(db: Db) {
  const { day, month } = periodStarts();
  const totals = await db.execute(sql`
    select
      coalesce(sum(input_tokens), 0)::int as "inputTokens",
      coalesce(sum(output_tokens), 0)::int as "outputTokens",
      coalesce(sum(estimated_cost_micros), 0)::bigint as "costMicros",
      count(*)::int as calls,
      count(*) filter (where success = false)::int as failures
    from ai_usage where created_at >= ${month}
  `);
  const byUser = await db.execute(sql`
    select u.id, u.name, u.email,
      coalesce(sum(a.input_tokens + a.output_tokens) filter (where a.created_at >= ${day}), 0)::int as "todayTokens",
      coalesce(sum(a.input_tokens + a.output_tokens), 0)::int as "monthTokens",
      coalesce(sum(a.estimated_cost_micros), 0)::bigint as "costMicros",
      u.daily_token_limit as "dailyTokenLimit", u.monthly_token_limit as "monthlyTokenLimit"
    from users u left join ai_usage a on a.user_id = u.id and a.created_at >= ${month}
    group by u.id order by "monthTokens" desc
  `);
  const byConversation = await db.execute(sql`
    select c.id, coalesce(c.title, 'Nova conversa') as title, u.name as "userName",
      coalesce(sum(a.input_tokens + a.output_tokens), 0)::int as tokens,
      coalesce(sum(a.estimated_cost_micros), 0)::bigint as "costMicros"
    from ai_usage a join conversations c on c.id = a.conversation_id join users u on u.id = a.user_id
    where a.created_at >= ${month}
    group by c.id, u.name order by tokens desc limit 20
  `);
  // postgres-js pode devolver colunas bigint como string ou bigint. Converta
  // tudo antes de atravessar a fronteira Server Component -> Client Component.
  // Um bigint em `byUser`, por exemplo, derruba a página inteira durante a
  // serialização do React Server Components.
  const numberValue = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const nullableNumber = (value: unknown) => value == null ? null : numberValue(value);
  const totalRow = (totals[0] ?? {}) as Record<string, unknown>;

  return {
    totals: {
      inputTokens: numberValue(totalRow.inputTokens),
      outputTokens: numberValue(totalRow.outputTokens),
      costMicros: numberValue(totalRow.costMicros),
      calls: numberValue(totalRow.calls),
      failures: numberValue(totalRow.failures),
    },
    byUser: [...byUser].map((value) => {
      const row = value as Record<string, unknown>;
      return {
        id: String(row.id),
        name: String(row.name ?? ""),
        email: String(row.email ?? ""),
        todayTokens: numberValue(row.todayTokens),
        monthTokens: numberValue(row.monthTokens),
        costMicros: numberValue(row.costMicros),
        dailyTokenLimit: nullableNumber(row.dailyTokenLimit),
        monthlyTokenLimit: nullableNumber(row.monthlyTokenLimit),
      };
    }),
    byConversation: [...byConversation].map((value) => {
      const row = value as Record<string, unknown>;
      return {
        id: String(row.id),
        title: String(row.title ?? "Nova conversa"),
        userName: String(row.userName ?? ""),
        tokens: numberValue(row.tokens),
        costMicros: numberValue(row.costMicros),
      };
    }),
  };
}

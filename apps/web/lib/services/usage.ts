import { and, desc, eq, gte, sql } from "drizzle-orm";
import { aiUsage, conversations, settings, users } from "@/lib/db/schema";
import { estimateCostMicros } from "@/lib/ai/models";
import type { Db, Tx } from "@/lib/db";

function periodStarts(now = new Date()) {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  const week = new Date(day);
  week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { day, week, month };
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
    const { day, week, month } = periodStarts();
    const reservation = input.estimatedInputTokens + input.maxOutputTokens;
    const dayAll = await sumUsage(tx, day);
    const weekAll = await sumUsage(tx, week);
    const monthAll = await sumUsage(tx, month);
    const dayUser = await sumUsage(tx, day, input.userId);
    const weekUser = await sumUsage(tx, week, input.userId);
    const monthUser = await sumUsage(tx, month, input.userId);
    const globalDaily = config?.dailyTokenLimit ?? 200_000;
    const globalWeekly = config?.weeklyTokenLimit ?? 1_000_000;
    const globalMonthly = config?.monthlyTokenLimit ?? 4_000_000;
    const userDaily = user.dailyTokenLimit ?? globalDaily;
    const userWeekly = user.weeklyTokenLimit ?? globalWeekly;
    const userMonthly = user.monthlyTokenLimit ?? globalMonthly;
    if (dayAll + reservation > globalDaily) throw Response.json({ error: "Cota diária da instalação atingida" }, { status: 429 });
    if (weekAll + reservation > globalWeekly) throw Response.json({ error: "Cota semanal da instalação atingida" }, { status: 429 });
    if (monthAll + reservation > globalMonthly) throw Response.json({ error: "Cota mensal da instalação atingida" }, { status: 429 });
    if (dayUser + reservation > userDaily) throw Response.json({ error: "Sua cota diária de IA foi atingida" }, { status: 429 });
    if (weekUser + reservation > userWeekly) throw Response.json({ error: "Sua cota semanal de IA foi atingida" }, { status: 429 });
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

export async function recordGenerationUsage(db: Db, input: {
  userId: string;
  conversationId?: string | null;
  kind: "image" | "artifact";
  model: string;
  durationMs: number;
  success: boolean;
  error?: string | null;
}) {
  await db.insert(aiUsage).values({
    userId: input.userId,
    conversationId: input.conversationId,
    kind: input.kind,
    model: input.model,
    durationMs: input.durationMs,
    success: input.success,
    error: input.error?.slice(0, 500) ?? null,
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

function quotaPeriod(used: number, limit: number, resetAt: Date, customized: boolean) {
  const safeLimit = Math.max(0, limit);
  return {
    used,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - used),
    percentage: safeLimit === 0 ? 100 : Math.min(100, Math.round((used / safeLimit) * 100)),
    resetAt: resetAt.toISOString(),
    customized,
  };
}

export async function getUserUsageSummary(db: Db, userId: string) {
  const now = new Date();
  const { day, week, month } = periodStarts(now);
  const nextDay = new Date(day);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextWeek = new Date(week);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const nextMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));

  const [configRows, userRows, totals, activity] = await Promise.all([
    db.select({
      daily: settings.dailyTokenLimit,
      weekly: settings.weeklyTokenLimit,
      monthly: settings.monthlyTokenLimit,
    }).from(settings).where(eq(settings.id, 1)),
    db.select({
      daily: users.dailyTokenLimit,
      weekly: users.weeklyTokenLimit,
      monthly: users.monthlyTokenLimit,
    }).from(users).where(eq(users.id, userId)),
    db.execute(sql`
      select
        coalesce(sum(greatest(input_tokens + output_tokens, reserved_tokens)) filter (where created_at >= ${day}), 0)::bigint as "dailyUsed",
        coalesce(sum(greatest(input_tokens + output_tokens, reserved_tokens)) filter (where created_at >= ${week}), 0)::bigint as "weeklyUsed",
        coalesce(sum(greatest(input_tokens + output_tokens, reserved_tokens)) filter (where created_at >= ${month}), 0)::bigint as "monthlyUsed"
      from ai_usage
      where user_id = ${userId}
        and created_at >= ${week.getTime() < month.getTime() ? week : month}
    `),
    db.select({
      id: aiUsage.id,
      kind: aiUsage.kind,
      model: aiUsage.model,
      inputTokens: aiUsage.inputTokens,
      outputTokens: aiUsage.outputTokens,
      reservedTokens: aiUsage.reservedTokens,
      durationMs: aiUsage.durationMs,
      success: aiUsage.success,
      createdAt: aiUsage.createdAt,
      finishedAt: aiUsage.finishedAt,
      conversationId: aiUsage.conversationId,
      conversationTitle: conversations.title,
    }).from(aiUsage)
      .leftJoin(conversations, eq(conversations.id, aiUsage.conversationId))
      .where(eq(aiUsage.userId, userId))
      .orderBy(desc(aiUsage.createdAt))
      .limit(30),
  ]);

  const numberValue = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const config = configRows[0];
  const user = userRows[0];
  if (!user) throw new Error("Usuário não encontrado");
  const dailyLimit = user.daily ?? config?.daily ?? 200_000;
  const weeklyLimit = user.weekly ?? config?.weekly ?? 1_000_000;
  const monthlyLimit = user.monthly ?? config?.monthly ?? 4_000_000;
  const totalRow = (totals[0] ?? {}) as Record<string, unknown>;

  return {
    updatedAt: now.toISOString(),
    periods: {
      daily: quotaPeriod(numberValue(totalRow.dailyUsed), dailyLimit, nextDay, user.daily != null),
      weekly: quotaPeriod(numberValue(totalRow.weeklyUsed), weeklyLimit, nextWeek, user.weekly != null),
      monthly: quotaPeriod(numberValue(totalRow.monthlyUsed), monthlyLimit, nextMonth, user.monthly != null),
    },
    interactions: activity.map((row) => {
      const inputTokens = numberValue(row.inputTokens);
      const outputTokens = numberValue(row.outputTokens);
      const reservedTokens = numberValue(row.reservedTokens);
      const processing = row.finishedAt == null;
      return {
        id: row.id,
        kind: row.kind,
        model: row.model,
        conversationId: row.conversationId,
        conversationTitle: row.conversationTitle ?? "Nova conversa",
        inputTokens,
        outputTokens,
        tokens: Math.max(inputTokens + outputTokens, reservedTokens),
        processing,
        success: row.success,
        durationMs: row.durationMs == null ? null : numberValue(row.durationMs),
        createdAt: row.createdAt.toISOString(),
        finishedAt: row.finishedAt?.toISOString() ?? null,
      };
    }),
  };
}

export async function getUsageDashboard(db: Db) {
  const { day, week, month } = periodStarts();
  const userUsageSince = week.getTime() < month.getTime() ? week : month;
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
      coalesce(sum(a.input_tokens + a.output_tokens) filter (where a.created_at >= ${week}), 0)::int as "weekTokens",
      coalesce(sum(a.input_tokens + a.output_tokens) filter (where a.created_at >= ${month}), 0)::int as "monthTokens",
      coalesce(sum(a.estimated_cost_micros) filter (where a.created_at >= ${month}), 0)::bigint as "costMicros",
      u.daily_token_limit as "dailyTokenLimit", u.weekly_token_limit as "weeklyTokenLimit", u.monthly_token_limit as "monthlyTokenLimit"
    from users u left join ai_usage a on a.user_id = u.id and a.created_at >= ${userUsageSince}
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
        weekTokens: numberValue(row.weekTokens),
        monthTokens: numberValue(row.monthTokens),
        costMicros: numberValue(row.costMicros),
        dailyTokenLimit: nullableNumber(row.dailyTokenLimit),
        weeklyTokenLimit: nullableNumber(row.weeklyTokenLimit),
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

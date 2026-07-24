import { mkdir, statfs } from "fs/promises";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { artifactJobs, assistantFiles, aiUsage, corporateMemories, globalContextFiles, projectFiles } from "@/lib/db/schema";
import { uploadsDir } from "@/lib/files/storage";
import { getOpenAIKey, getSettings } from "@/lib/services/settings";
import { logSystemError } from "@/lib/services/system-errors";

type Check = { status: "ok" | "warning" | "error"; message: string; durationMs?: number };
type SchemaCheck = Check & { missing: string[] };

async function databaseCheck(): Promise<Check> {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return { status: "ok", message: "Conectado", durationMs: Date.now() - started };
  } catch {
    return { status: "error", message: "Sem conexão", durationMs: Date.now() - started };
  }
}

async function schemaCheck(): Promise<SchemaCheck> {
  const started = Date.now();
  try {
    const rows = await db.execute(sql`
      select
        to_regclass('public.ai_usage') is not null as "aiUsage",
        to_regclass('public.project_files') is not null as "projectFiles",
        to_regclass('public.artifact_jobs') is not null as "artifactJobs",
        to_regclass('public.system_errors') is not null as "systemErrors",
        exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'settings' and column_name = 'daily_token_limit') as "settingsDaily",
        exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'settings' and column_name = 'weekly_token_limit') as "settingsWeekly",
        exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'settings' and column_name = 'monthly_token_limit') as "settingsMonthly",
        exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'settings' and column_name = 'system_version') as "settingsVersion",
        exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'daily_token_limit') as "usersDaily",
        exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'weekly_token_limit') as "usersWeekly",
        exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'monthly_token_limit') as "usersMonthly"
    `);
    const row = (rows[0] ?? {}) as Record<string, unknown>;
    const required: Array<[string, string]> = [
      ["aiUsage", "tabela ai_usage"],
      ["projectFiles", "tabela project_files"],
      ["artifactJobs", "tabela artifact_jobs"],
      ["systemErrors", "tabela system_errors"],
      ["settingsDaily", "settings.daily_token_limit"],
      ["settingsWeekly", "settings.weekly_token_limit"],
      ["settingsMonthly", "settings.monthly_token_limit"],
      ["settingsVersion", "settings.system_version"],
      ["usersDaily", "users.daily_token_limit"],
      ["usersWeekly", "users.weekly_token_limit"],
      ["usersMonthly", "users.monthly_token_limit"],
    ];
    const missing = required.filter(([key]) => row[key] !== true).map(([, label]) => label);
    return {
      status: missing.length > 0 ? "error" : "ok",
      message: missing.length > 0 ? `${missing.length} item(ns) pendente(s) de migration` : "Estrutura atualizada",
      durationMs: Date.now() - started,
      missing,
    };
  } catch {
    return { status: "error", message: "Não foi possível validar as migrations", durationMs: Date.now() - started, missing: [] };
  }
}

async function openAiCheck(): Promise<Check> {
  const started = Date.now();
  try {
    const key = await getOpenAIKey(db);
    const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/v1$/, "");
    const response = await fetch(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (response.ok) return { status: "ok", message: "Configurada e acessível", durationMs: Date.now() - started };
    if (response.status === 401) return { status: "error", message: "Chave inválida", durationMs: Date.now() - started };
    if (response.status === 429) return { status: "warning", message: "Limite temporário da OpenAI", durationMs: Date.now() - started };
    return { status: "error", message: `OpenAI respondeu HTTP ${response.status}`, durationMs: Date.now() - started };
  } catch (error) {
    const missing = error instanceof Error && error.message.includes("não configurada");
    return { status: missing ? "warning" : "error", message: missing ? "Chave não configurada" : "OpenAI indisponível", durationMs: Date.now() - started };
  }
}

async function storageCheck(): Promise<Check & { totalBytes?: number; freeBytes?: number; usedPercent?: number }> {
  try {
    await mkdir(uploadsDir(), { recursive: true });
    const stats = await statfs(uploadsDir());
    // Normalize também protege a renderização caso a implementação da
    // plataforma retorne os campos de statfs como bigint.
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const usedPercent = totalBytes > 0 ? ((totalBytes - freeBytes) / totalBytes) * 100 : 0;
    return {
      status: usedPercent >= 95 ? "error" : usedPercent >= 85 ? "warning" : "ok",
      message: usedPercent >= 95 ? "Volume quase cheio" : usedPercent >= 85 ? "Espaço baixo" : "Espaço disponível",
      totalBytes, freeBytes, usedPercent,
    };
  } catch {
    return { status: "error", message: "Não foi possível verificar o volume" };
  }
}

async function updateCheck(): Promise<Check & { currentVersion: string; latestVersion?: string }> {
  const currentVersion = process.env.APP_VERSION ?? "0.1.0";
  try {
    const response = await fetch("https://api.github.com/repos/marcelodorr/G4-IA-Assistente/releases/latest", {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Sequor-IA-Assistente" },
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 1800 },
    });
    if (!response.ok) return { status: "warning", message: "Sem release publicada para comparação", currentVersion };
    const data = await response.json() as { tag_name?: string };
    const latestVersion = data.tag_name?.replace(/^v/, "");
    if (!latestVersion) return { status: "warning", message: "Versão mais recente desconhecida", currentVersion };
    const update = latestVersion !== currentVersion;
    return { status: update ? "warning" : "ok", message: update ? "Atualização disponível" : "Versão atual", currentVersion, latestVersion };
  } catch {
    return { status: "warning", message: "Não foi possível verificar atualizações", currentVersion };
  }
}

export async function getAdminHealth() {
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const checks = await Promise.all([databaseCheck(), openAiCheck(), storageCheck(), updateCheck()]);
  const database = checks[0];
  const [, openai, storage, update] = checks;
  const schema = database.status === "ok"
    ? await schemaCheck()
    : { status: "error" as const, message: "Aguardando conexão com o banco", missing: [] };
  let jobs: Array<{ status: string; total: number }> = [];
  let usage: Array<{ calls: number; failures: number; tokens: number }> = [];
  let configured = { hasOpenAiKey: false, defaultModel: "desconhecido" };
  const unavailable: string[] = [];
  if (database.status === "ok") {
    const safeMetric = async <T>(label: string, query: () => Promise<T>, fallback: T) => {
      try {
        return await query();
      } catch (error) {
        console.error(`[admin/saude] Falha ao consultar ${label}`, error);
        await logSystemError(db, { error, source: `Saúde: ${label}`, path: "/admin/saude", severity: "warning" });
        unavailable.push(label);
        return fallback;
      }
    };
    const [assistantJobs, globalJobs, projectJobs, memoryJobs, artifactJobRows, usageRows, configuredSettings] = await Promise.all([
      safeMetric("arquivos de assistentes", () => db.select({ status: assistantFiles.status, total: sql<number>`count(*)::int` }).from(assistantFiles).groupBy(assistantFiles.status), []),
      safeMetric("arquivos do contexto geral", () => db.select({ status: globalContextFiles.status, total: sql<number>`count(*)::int` }).from(globalContextFiles).groupBy(globalContextFiles.status), []),
      safeMetric("arquivos de projetos", () => db.select({ status: projectFiles.status, total: sql<number>`count(*)::int` }).from(projectFiles).groupBy(projectFiles.status), []),
      safeMetric("memórias corporativas", () => db.select({ status: corporateMemories.status, total: sql<number>`count(*)::int` }).from(corporateMemories).groupBy(corporateMemories.status), []),
      safeMetric("geração de imagens", () => db.select({ status: artifactJobs.status, total: sql<number>`count(*)::int` }).from(artifactJobs).groupBy(artifactJobs.status), []),
      safeMetric("uso das últimas 24 horas", () => db.select({
        calls: sql<number>`count(*)::int`,
        failures: sql<number>`count(*) filter (where ${aiUsage.success} = false)::int`,
        tokens: sql<number>`coalesce(sum(greatest(${aiUsage.inputTokens} + ${aiUsage.outputTokens}, ${aiUsage.reservedTokens})), 0)::bigint`,
      }).from(aiUsage).where(sql`${aiUsage.createdAt} >= ${since}`), []),
      safeMetric("configurações de IA", () => getSettings(db).then((value) => ({ hasOpenAiKey: value.hasKey, defaultModel: value.defaultModel })), configured),
    ]);
    jobs = [...assistantJobs, ...globalJobs, ...projectJobs, ...memoryJobs, ...artifactJobRows];
    usage = usageRows;
    configured = configuredSettings;
  }
  const jobCounts = jobs.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + Number(row.total);
    return counts;
  }, {});
  return {
    checkedAt: new Date(), database, schema, openai, storage, update, unavailable,
    jobs: { pending: (jobCounts.pending ?? 0) + (jobCounts.processing ?? 0), errors: jobCounts.error ?? 0 },
    usage: { calls: Number(usage[0]?.calls ?? 0), failures: Number(usage[0]?.failures ?? 0), tokens: Number(usage[0]?.tokens ?? 0) },
    configured,
  };
}

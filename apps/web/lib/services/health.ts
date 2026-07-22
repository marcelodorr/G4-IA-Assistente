import { mkdir, statfs } from "fs/promises";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assistantFiles, aiUsage, corporateMemories, globalContextFiles } from "@/lib/db/schema";
import { uploadsDir } from "@/lib/files/storage";
import { getOpenAIKey, getSettings } from "@/lib/services/settings";

type Check = { status: "ok" | "warning" | "error"; message: string; durationMs?: number };

async function databaseCheck(): Promise<Check> {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return { status: "ok", message: "Conectado", durationMs: Date.now() - started };
  } catch {
    return { status: "error", message: "Sem conexão", durationMs: Date.now() - started };
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
  let database = checks[0];
  const [, openai, storage, update] = checks;
  let jobs: Array<{ status: string; total: number }> = [];
  let usage: Array<{ calls: number; failures: number; tokens: number }> = [];
  let configured = { hasOpenAiKey: false, defaultModel: "desconhecido" };
  if (database.status === "ok") {
    try {
      const [assistantJobs, globalJobs, memoryJobs, usageRows, configuredSettings] = await Promise.all([
        db.select({ status: assistantFiles.status, total: sql<number>`count(*)::int` }).from(assistantFiles).groupBy(assistantFiles.status),
        db.select({ status: globalContextFiles.status, total: sql<number>`count(*)::int` }).from(globalContextFiles).groupBy(globalContextFiles.status),
        db.select({ status: corporateMemories.status, total: sql<number>`count(*)::int` }).from(corporateMemories).groupBy(corporateMemories.status),
        db.select({
          calls: sql<number>`count(*)::int`,
          failures: sql<number>`count(*) filter (where ${aiUsage.success} = false)::int`,
          tokens: sql<number>`coalesce(sum(${aiUsage.inputTokens} + ${aiUsage.outputTokens}), 0)::bigint`,
        }).from(aiUsage).where(sql`${aiUsage.createdAt} >= ${since}`),
        getSettings(db).then((value) => ({ hasOpenAiKey: value.hasKey, defaultModel: value.defaultModel })),
      ]);
      jobs = [...assistantJobs, ...globalJobs, ...memoryJobs];
      usage = usageRows;
      configured = configuredSettings;
    } catch (error) {
      console.error("[admin/saude] Falha ao consultar métricas do banco", error);
      database = {
        ...database,
        status: "warning",
        message: "Conectado, mas as métricas falharam. Verifique as migrations.",
      };
    }
  }
  const jobCounts = jobs.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + Number(row.total);
    return counts;
  }, {});
  return {
    checkedAt: new Date(), database, openai, storage, update,
    jobs: { pending: (jobCounts.pending ?? 0) + (jobCounts.processing ?? 0), errors: jobCounts.error ?? 0 },
    usage: { calls: Number(usage[0]?.calls ?? 0), failures: Number(usage[0]?.failures ?? 0), tokens: Number(usage[0]?.tokens ?? 0) },
    configured,
  };
}

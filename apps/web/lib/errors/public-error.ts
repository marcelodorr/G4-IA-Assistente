type PublicError = { status: number; code: string; message: string };

export function getPublicError(error: unknown): PublicError {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
  const normalized = `${raw} ${code}`.toLowerCase();

  if (code === "ENOSPC" || normalized.includes("no space left")) return { status: 507, code: "STORAGE_FULL", message: "O armazenamento está cheio. Remova arquivos ou aumente o volume." };
  if (status === 401 || normalized.includes("invalid_api_key") || normalized.includes("incorrect api key")) return { status: 503, code: "OPENAI_AUTH", message: "A chave da OpenAI está inválida. Peça ao administrador para atualizá-la." };
  if (status === 429 || normalized.includes("rate limit")) return { status: 503, code: "OPENAI_RATE_LIMIT", message: "A OpenAI atingiu um limite temporário. Aguarde alguns instantes e tente novamente." };
  if (normalized.includes("insufficient_quota") || normalized.includes("exceeded your current quota")) return { status: 503, code: "OPENAI_QUOTA", message: "A conta da OpenAI está sem créditos ou atingiu sua cota." };
  if (status === 404 || normalized.includes("model_not_found") || normalized.includes("does not have access to model")) return { status: 409, code: "MODEL_UNAVAILABLE", message: "O modelo selecionado não está disponível para esta chave da OpenAI." };
  if (normalized.includes("timeout") || code === "ETIMEDOUT") return { status: 504, code: "UPSTREAM_TIMEOUT", message: "A OpenAI demorou demais para responder. Tente novamente." };
  if (["ECONNREFUSED", "ECONNRESET", "ENOTFOUND"].includes(code)) return { status: 503, code: "SERVICE_UNAVAILABLE", message: "Um serviço necessário está indisponível. Tente novamente em alguns minutos." };
  return { status: 500, code: "INTERNAL_ERROR", message: "Não foi possível concluir a operação. Tente novamente." };
}

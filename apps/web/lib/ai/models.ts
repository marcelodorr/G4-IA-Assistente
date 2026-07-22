export type ModelPolicy = {
  id: string;
  label: string;
  acceptsImages: boolean;
  supportsTools: boolean;
  contextWindow: number;
  maxOutputTokens: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  expensive: boolean;
};

// Preços padrão por 1 milhão de tokens, consultados na documentação oficial
// da OpenAI em 22/07/2026. O custo persistido é sempre identificado como
// estimativa, pois preços e descontos de cache/lote podem mudar.
export const MODEL_POLICIES = [
  { id: "gpt-5", label: "GPT-5", acceptsImages: true, supportsTools: true, contextWindow: 400_000, maxOutputTokens: 128_000, inputUsdPerMillion: 1.25, outputUsdPerMillion: 10, expensive: true },
  { id: "gpt-5-mini", label: "GPT-5 mini", acceptsImages: true, supportsTools: true, contextWindow: 400_000, maxOutputTokens: 128_000, inputUsdPerMillion: 0.25, outputUsdPerMillion: 2, expensive: false },
  { id: "gpt-4.1", label: "GPT-4.1", acceptsImages: true, supportsTools: true, contextWindow: 1_047_576, maxOutputTokens: 32_768, inputUsdPerMillion: 2, outputUsdPerMillion: 8, expensive: true },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini", acceptsImages: true, supportsTools: true, contextWindow: 1_047_576, maxOutputTokens: 32_768, inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6, expensive: false },
  { id: "gpt-4o", label: "GPT-4o", acceptsImages: true, supportsTools: true, contextWindow: 128_000, maxOutputTokens: 16_384, inputUsdPerMillion: 2.5, outputUsdPerMillion: 10, expensive: true },
  { id: "gpt-4o-mini", label: "GPT-4o mini", acceptsImages: true, supportsTools: true, contextWindow: 128_000, maxOutputTokens: 16_384, inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6, expensive: false },
] as const satisfies readonly ModelPolicy[];

export const SUPPORTED_MODELS: string[] = MODEL_POLICIES.map((model) => model.id);
export const DEFAULT_MODEL = "gpt-5-mini";

export function isAllowedModel(model: string): boolean {
  return SUPPORTED_MODELS.includes(model);
}

export function getModelPolicy(model: string): ModelPolicy | null {
  return MODEL_POLICIES.find((item) => item.id === model) ?? null;
}

export function isModelEnabled(model: string, disabledModels: string[]): boolean {
  return isAllowedModel(model) && !disabledModels.includes(model);
}

export function estimateCostMicros(model: string, inputTokens: number, outputTokens: number): number {
  const policy = getModelPolicy(model);
  if (!policy) return 0;
  return Math.round(inputTokens * policy.inputUsdPerMillion + outputTokens * policy.outputUsdPerMillion);
}

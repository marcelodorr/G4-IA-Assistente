export const SUPPORTED_MODELS = ["gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"];
export const DEFAULT_MODEL = "gpt-5-mini";

export function isAllowedModel(model: string): boolean {
  return SUPPORTED_MODELS.includes(model);
}

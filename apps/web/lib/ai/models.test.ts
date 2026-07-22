import { describe, expect, it } from "vitest";
import { estimateCostMicros, getModelPolicy, isModelEnabled } from "./models";

describe("model policy", () => {
  it("centraliza capacidade e bloqueio por configuração", () => {
    expect(getModelPolicy("gpt-5-mini")?.acceptsImages).toBe(true);
    expect(isModelEnabled("gpt-5-mini", ["gpt-5-mini"])).toBe(false);
    expect(isModelEnabled("modelo-inexistente", [])).toBe(false);
  });

  it("estima custo em milionésimos de dólar", () => {
    expect(estimateCostMicros("gpt-5-mini", 1_000_000, 1_000_000)).toBe(2_250_000);
  });
});

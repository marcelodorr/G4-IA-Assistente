import { describe, expect, it } from "vitest";
import { getPublicError } from "./public-error";

describe("getPublicError", () => {
  it("traduz falhas comuns sem expor a mensagem interna", () => {
    expect(getPublicError(Object.assign(new Error("sk-secret no space left on device"), { code: "ENOSPC" }))).toEqual({ status: 507, code: "STORAGE_FULL", message: "O armazenamento está cheio. Remova arquivos ou aumente o volume." });
    expect(getPublicError(Object.assign(new Error("Incorrect API key: sk-secret"), { status: 401 })).message).not.toContain("sk-secret");
    expect(getPublicError(Object.assign(new Error("model_not_found"), { status: 404 })).code).toBe("MODEL_UNAVAILABLE");
    expect(getPublicError(new Error("stack e detalhes privados"))).toEqual({ status: 500, code: "INTERNAL_ERROR", message: "Não foi possível concluir a operação. Tente novamente." });
  });
});

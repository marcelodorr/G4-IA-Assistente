import { describe, it, expect, beforeEach } from "vitest";
import { encrypt, decrypt } from "./crypto";

describe("crypto", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
  });

  it("roundtrip encrypt/decrypt", () => {
    const payload = encrypt("sk-test-123");
    expect(payload).not.toContain("sk-test-123");
    expect(decrypt(payload)).toBe("sk-test-123");
  });

  it("payloads diferentes para o mesmo texto (IV aleatório)", () => {
    expect(encrypt("x")).not.toBe(encrypt("x"));
  });

  it("falha se o payload for adulterado", () => {
    const p = encrypt("segredo");
    const [iv, , tag] = p.split(".");
    const tampered = [iv, Buffer.from("aaaa").toString("base64"), tag].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("falha com chave inválida", () => {
    process.env.ENCRYPTION_KEY = "curta";
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
  });
});

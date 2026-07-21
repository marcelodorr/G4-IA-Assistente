import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hash e verificação", async () => {
    const hash = await hashPassword("senha123");
    expect(hash).not.toBe("senha123");
    expect(await verifyPassword("senha123", hash)).toBe(true);
    expect(await verifyPassword("errada", hash)).toBe(false);
  });
});

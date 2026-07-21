import { describe, it, expect } from "vitest";
import { verifyCredentials } from "./verify-credentials";
import { hashPassword } from "./password";

describe("verifyCredentials", () => {
  const makeUser = async (over = {}) => ({
    id: "u1", name: "Ana", email: "ana@g4.com", role: "member" as const,
    active: true, passwordHash: await hashPassword("senha123"), createdAt: new Date(), ...over,
  });

  it("retorna usuário com credenciais corretas (email normalizado)", async () => {
    const user = await makeUser();
    const result = await verifyCredentials("  ANA@g4.com ", "senha123", async () => user);
    expect(result).toEqual({ id: "u1", name: "Ana", email: "ana@g4.com", role: "member" });
  });

  it("null para senha errada", async () => {
    const user = await makeUser();
    expect(await verifyCredentials("ana@g4.com", "x", async () => user)).toBeNull();
  });

  it("null para usuário inexistente ou inativo", async () => {
    expect(await verifyCredentials("x@x.com", "s", async () => null)).toBeNull();
    const inativo = await makeUser({ active: false });
    expect(await verifyCredentials("ana@g4.com", "senha123", async () => inativo)).toBeNull();
  });
});

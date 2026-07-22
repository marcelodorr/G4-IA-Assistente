import { describe, it, expect } from "vitest";
import { verifyCredentials } from "./verify-credentials";
import { hashPassword } from "./password";

describe("verifyCredentials", () => {
  const makeUser = async (over = {}) => ({
    id: "u1", name: "Ana", email: "ana@sequor.com.br", role: "member" as const,
    active: true, passwordHash: await hashPassword("senha123"), createdAt: new Date(), ...over,
  });

  it("retorna usuário com credenciais corretas (email normalizado)", async () => {
    const user = await makeUser();
    const result = await verifyCredentials("  ANA@sequor.com.br ", "senha123", async () => user);
    expect(result).toEqual({ id: "u1", name: "Ana", email: "ana@sequor.com.br", role: "member" });
  });

  it("null para senha errada", async () => {
    const user = await makeUser();
    expect(await verifyCredentials("ana@sequor.com.br", "x", async () => user)).toBeNull();
  });

  it("null para usuário inexistente ou inativo", async () => {
    expect(await verifyCredentials("x@x.com", "s", async () => null)).toBeNull();
    const inativo = await makeUser({ active: false });
    expect(await verifyCredentials("ana@sequor.com.br", "senha123", async () => inativo)).toBeNull();
  });
});

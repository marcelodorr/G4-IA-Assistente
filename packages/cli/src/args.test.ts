import { describe, it, expect } from "vitest";
import { resolverModo } from "./args";

describe("resolverModo", () => {
  it("sem flags e com TTY em stdin/stdout: interativo", () => {
    expect(resolverModo([], true, true)).toEqual({ tipo: "interativo" });
  });

  it("sem flags e sem TTY (stdin): orientacao-agente", () => {
    expect(resolverModo([], false, true)).toEqual({ tipo: "orientacao-agente" });
  });

  it("sem flags e sem TTY (stdout): orientacao-agente", () => {
    expect(resolverModo([], true, false)).toEqual({ tipo: "orientacao-agente" });
  });

  it("sem flags e sem TTY em nenhum dos dois: orientacao-agente", () => {
    expect(resolverModo([], false, false)).toEqual({ tipo: "orientacao-agente" });
  });

  it("--yes sozinho: nao-interativo com nome padrão", () => {
    expect(resolverModo(["--yes"], true, true)).toEqual({ tipo: "nao-interativo", nome: "g4-ia-assistente" });
  });

  it("-y sozinho: nao-interativo com nome padrão", () => {
    expect(resolverModo(["-y"], true, true)).toEqual({ tipo: "nao-interativo", nome: "g4-ia-assistente" });
  });

  it("--yes com --nome: nao-interativo com o nome informado", () => {
    expect(resolverModo(["--yes", "--nome", "meu-projeto"], true, true)).toEqual({
      tipo: "nao-interativo",
      nome: "meu-projeto",
    });
  });

  it("--nome sozinho (sem --yes): também é nao-interativo (intenção clara)", () => {
    expect(resolverModo(["--nome", "meu-projeto"], true, true)).toEqual({
      tipo: "nao-interativo",
      nome: "meu-projeto",
    });
  });

  it("--nome inválido lança erro em pt-BR", () => {
    expect(() => resolverModo(["--nome", "AB"], true, true)).toThrow(
      "Nome inválido: use letras minúsculas, números e hífens (3-40 caracteres)"
    );
  });

  it("--nome inválido (caracteres não permitidos) lança erro", () => {
    expect(() => resolverModo(["--yes", "--nome", "Meu_Projeto!"], true, true)).toThrow(/Nome inválido/);
  });

  it("--help: ajuda", () => {
    expect(resolverModo(["--help"], true, true)).toEqual({ tipo: "ajuda" });
  });

  it("-h: ajuda", () => {
    expect(resolverModo(["-h"], true, true)).toEqual({ tipo: "ajuda" });
  });

  it("--ajuda: ajuda", () => {
    expect(resolverModo(["--ajuda"], true, true)).toEqual({ tipo: "ajuda" });
  });

  it("--help tem prioridade mesmo sem TTY", () => {
    expect(resolverModo(["--help"], false, false)).toEqual({ tipo: "ajuda" });
  });

  it("flags desconhecidas são ignoradas (strict:false)", () => {
    expect(resolverModo(["--flag-desconhecida", "valor"], true, true)).toEqual({ tipo: "interativo" });
  });
});

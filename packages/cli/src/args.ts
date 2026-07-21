import { parseArgs } from "node:util";

export type Modo =
  | { tipo: "interativo" }
  | { tipo: "nao-interativo"; nome: string }
  | { tipo: "ajuda" }
  | { tipo: "orientacao-agente" };

const NOME_PADRAO = "g4-ia-assistente";
const NOME_REGEX = /^[a-z0-9-]{3,40}$/;

function validarNome(nome: string): string {
  if (!NOME_REGEX.test(nome)) {
    throw new Error("Nome inválido: use letras minúsculas, números e hífens (3-40 caracteres)");
  }
  return nome;
}

export function resolverModo(argv: string[], stdinTTY: boolean, stdoutTTY: boolean): Modo {
  const { values } = parseArgs({
    args: argv,
    strict: false,
    options: {
      help: { type: "boolean", short: "h" },
      ajuda: { type: "boolean" },
      yes: { type: "boolean", short: "y" },
      nome: { type: "string" },
    },
  });

  if (values.help || values.ajuda) {
    return { tipo: "ajuda" };
  }

  if (values.yes) {
    const nome = typeof values.nome === "string" ? values.nome : NOME_PADRAO;
    return { tipo: "nao-interativo", nome: validarNome(nome) };
  }

  if (typeof values.nome === "string") {
    return { tipo: "nao-interativo", nome: validarNome(values.nome) };
  }

  if (!stdinTTY || !stdoutTTY) {
    return { tipo: "orientacao-agente" };
  }

  return { tipo: "interativo" };
}

#!/usr/bin/env node
import { intro, outro, text, confirm, spinner, isCancel, cancel, log } from "@clack/prompts";
import pc from "picocolors";
import { run } from "./runner.js";
import { checkRailway, isLinkedProject } from "./steps.js";
import { resolverModo, type Modo } from "./args.js";
import { instalar, atualizar, obterUrl, abrirNavegador, appDir, type Ui } from "./fluxo.js";

const sequor = (s: string) => pc.bold(pc.cyan(s));

function mensagensRailway(motivo: "nao-instalada" | "nao-logada"): [string, string] {
  return motivo === "nao-instalada"
    ? [
        "A Railway CLI não está instalada.",
        "Instale com: " + pc.cyan("npm install -g @railway/cli") + " (ou brew install railway no mac)",
      ]
    : [
        "Você não está logado na Railway CLI.",
        "Rode: " + pc.cyan("railway login") + " e depois execute este comando de novo.",
      ];
}

function criarUiInterativa(): Ui {
  const s = spinner();
  return {
    passo: (msg) => s.start(msg),
    ok: (msg) => s.stop(msg),
    info: (msg) => log.info(msg),
  };
}

const uiPlana: Ui = {
  passo: (msg) => console.log(`→ ${msg}`),
  ok: (msg) => console.log(`✔ ${msg}`),
  info: (msg) => console.log(msg),
};

const USAGE = `Sequor IA Assistente — instalador CLI

Uso:
  npx g4-ia-assistente [opções]

Opções:
  --nome <nome>   Nome do projeto no Railway (letras minúsculas, números e hífens, 3-40 caracteres)
  --yes, -y       Modo não-interativo: não faz perguntas, usa --nome (ou "g4-ia-assistente" se omitido)
  --help, -h      Mostra esta ajuda

Exemplos:
  npx g4-ia-assistente
      Roda o assistente interativo (perguntas no terminal).

  npx g4-ia-assistente --yes --nome minha-empresa
      Instala (ou atualiza, se já existir) sem perguntas — ideal para scripts e agentes de IA.

Nota para agentes de IA: se este terminal não for interativo, o comando entra
automaticamente em um modo de orientação explicando como usar --yes/--nome.`;

const ORIENTACAO_AGENTE = `Este comando abre um assistente interativo, mas este terminal não é interativo
(comum quando executado por um agente de IA como o Claude Code).

SE VOCÊ É UM AGENTE DE IA executando isto para um usuário:
  1. Pergunte ao usuário qual nome o projeto deve ter no Railway
     (letras minúsculas, números e hífens; sugestão: g4-ia-assistente).
  2. Confirme que ele já está logado na Railway CLI (railway login).
  3. Execute então o comando não-interativo:
       npx g4-ia-assistente --yes --nome <nome-escolhido>
     Se já existir uma instalação, esse comando atualiza e faz o redeploy.

Para ver todas as opções: npx g4-ia-assistente --help`;

function resolverModoOuSair(): Modo {
  try {
    return resolverModo(process.argv.slice(2), process.stdin.isTTY === true, process.stdout.isTTY === true);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

async function rodarInterativo() {
  intro(sequor("Sequor IA Assistente — instalação no Railway"));

  const check = await checkRailway(run);
  if (!check.ok) {
    const [erro, dica] = mensagensRailway(check.motivo);
    log.error(erro);
    log.info(dica);
    process.exit(1);
  }

  const ui = criarUiInterativa();

  const jaExiste = await isLinkedProject(run, appDir).catch(() => false);
  if (jaExiste) {
    const confirmaAtualizacao = await confirm({ message: "Já existe uma instalação. Atualizar o deploy existente?" });
    if (isCancel(confirmaAtualizacao) || !confirmaAtualizacao) {
      cancel("Nada foi alterado.");
      process.exit(0);
    }
    await atualizar(ui);
    outro(sequor("Atualização concluída! ✦"));
    return;
  }

  const nome = await text({
    message: "Nome do projeto no Railway:",
    initialValue: "g4-ia-assistente",
    validate: (v) => (/^[a-z0-9-]{3,40}$/.test(v) ? undefined : "Use letras minúsculas, números e hífens (3-40 caracteres)"),
  });
  if (isCancel(nome)) {
    cancel("Instalação cancelada.");
    process.exit(0);
  }

  const url = await instalar(nome, ui);

  log.success(`Seu assistente está em: ${sequor(url)}`);
  log.info("Abrindo o navegador para você concluir a configuração inicial...");
  await abrirNavegador(url);
  outro(sequor("Instalação concluída! Finalize o setup no navegador. ✦"));
}

async function rodarNaoInterativo(nome: string) {
  const check = await checkRailway(run);
  if (!check.ok) {
    const [erro, dica] = mensagensRailway(check.motivo);
    console.error(erro);
    console.error(dica);
    process.exit(1);
  }

  const jaExiste = await isLinkedProject(run, appDir).catch(() => false);
  let url: string;
  if (jaExiste) {
    uiPlana.info("Instalação existente encontrada — atualizando...");
    await atualizar(uiPlana);
    url = await obterUrl(uiPlana);
  } else {
    url = await instalar(nome, uiPlana);
  }

  uiPlana.info(`Seu assistente está em: ${url}`);
  uiPlana.info(`Acesse ${url}/setup para concluir a configuração.`);
}

async function main() {
  const modo = resolverModoOuSair();

  if (modo.tipo === "ajuda") {
    console.log(USAGE);
    process.exit(0);
  }

  if (modo.tipo === "orientacao-agente") {
    console.error(ORIENTACAO_AGENTE);
    process.exit(1);
  }

  if (modo.tipo === "nao-interativo") {
    await rodarNaoInterativo(modo.nome);
    return;
  }

  await rodarInterativo();
}

main().catch((e) => {
  log.error(e instanceof Error ? e.message : String(e));
  log.info("Se o problema persistir, rode novamente ou fale com o suporte da Sequor.");
  process.exit(1);
});

#!/usr/bin/env node
import { intro, outro, text, confirm, spinner, isCancel, cancel, log } from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import os from "os";
import open from "open";
import { run } from "./runner.js";
import { checkRailway, generateSecrets, createProject, addDatabase, linkService, addAppService, addVolume, deploy, getDomain, isLinkedProject } from "./steps.js";
import { downloadCode } from "./download.js";

const dourado = (s: string) => pc.bold(pc.yellow(s));

async function main() {
  intro(dourado("G4 IA Assistente — instalação no Railway"));

  const check = await checkRailway(run);
  if (!check.ok) {
    if (check.motivo === "nao-instalada") {
      log.error("A Railway CLI não está instalada.");
      log.info("Instale com: " + pc.cyan("npm install -g @railway/cli") + " (ou brew install railway no mac)");
    } else {
      log.error("Você não está logado na Railway CLI.");
      log.info("Rode: " + pc.cyan("railway login") + " e depois execute este comando de novo.");
    }
    process.exit(1);
  }

  const appDir = path.join(os.homedir(), ".g4-ia-assistente", "app");
  const s = spinner();

  const jaExiste = await isLinkedProject(run, appDir).catch(() => false);
  if (jaExiste) {
    const atualizar = await confirm({ message: "Já existe uma instalação. Atualizar o deploy existente?" });
    if (isCancel(atualizar) || !atualizar) { cancel("Nada foi alterado."); process.exit(0); }
    s.start("Baixando a versão mais recente");
    await downloadCode(appDir);
    s.stop("Código atualizado");
    s.start("Fazendo redeploy no Railway (isso pode levar alguns minutos)");
    await deploy(run, appDir);
    s.stop("Redeploy enviado");
    outro(dourado("Atualização concluída! ✦"));
    return;
  }

  const nome = await text({
    message: "Nome do projeto no Railway:",
    initialValue: "g4-ia-assistente",
    validate: (v) => (/^[a-z0-9-]{3,40}$/.test(v) ? undefined : "Use letras minúsculas, números e hífens (3-40 caracteres)"),
  });
  if (isCancel(nome)) { cancel("Instalação cancelada."); process.exit(0); }

  s.start("Baixando o código do G4 IA Assistente");
  await downloadCode(appDir);
  s.stop("Código baixado");

  s.start("Criando o projeto no Railway");
  await createProject(run, appDir, nome);
  s.stop("Projeto criado");

  const secrets = generateSecrets();

  s.start("Provisionando o banco Postgres (pgvector)");
  await addDatabase(run, appDir, secrets.DB_PASSWORD);
  await linkService(run, appDir, "db");
  await addVolume(run, appDir, "/var/lib/postgresql/data");
  s.stop("Postgres provisionado");

  s.start("Gerando chaves de segurança e configurando o serviço");
  await addAppService(run, appDir, secrets);
  s.stop("Serviço configurado");

  s.start("Anexando volume de arquivos");
  await linkService(run, appDir, "app");
  await addVolume(run, appDir, "/data");
  s.stop("Volume anexado");

  s.start("Fazendo o deploy (isso pode levar alguns minutos)");
  await deploy(run, appDir);
  s.stop("Deploy enviado");

  s.start("Gerando o endereço público");
  const url = await getDomain(run, appDir);
  s.stop("Endereço pronto");

  log.success(`Seu assistente está em: ${dourado(url)}`);
  log.info("Abrindo o navegador para você concluir a configuração inicial...");
  await open(`${url}/setup`).catch(() => {});
  outro(dourado("Instalação concluída! Finalize o setup no navegador. ✦"));
}

main().catch((e) => {
  log.error(e instanceof Error ? e.message : String(e));
  log.info("Se o problema persistir, rode novamente ou fale com o suporte do G4.");
  process.exit(1);
});

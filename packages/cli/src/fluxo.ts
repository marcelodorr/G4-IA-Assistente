import path from "path";
import os from "os";
import open from "open";
import { run } from "./runner.js";
import { generateSecrets, createProject, addDatabase, linkService, addAppService, addVolume, deploy, getDomain } from "./steps.js";
import { downloadCode } from "./download.js";

export type Ui = {
  passo(msg: string): void;
  ok(msg: string): void;
  info(msg: string): void;
};

export const appDir = path.join(os.homedir(), ".g4-ia-assistente", "app");

export async function obterUrl(ui: Ui): Promise<string> {
  ui.passo("Gerando o endereço público");
  const url = await getDomain(run, appDir);
  ui.ok("Endereço pronto");
  return url;
}

export async function instalar(nome: string, ui: Ui): Promise<string> {
  ui.passo("Baixando o código do G4 IA Assistente");
  await downloadCode(appDir);
  ui.ok("Código baixado");

  ui.passo("Criando o projeto no Railway");
  await createProject(run, appDir, nome);
  ui.ok("Projeto criado");

  const secrets = generateSecrets();

  ui.passo("Provisionando o banco Postgres (pgvector)");
  await addDatabase(run, appDir, secrets.DB_PASSWORD);
  await linkService(run, appDir, "db");
  await addVolume(run, appDir, "/var/lib/postgresql/data");
  ui.ok("Postgres provisionado");

  ui.passo("Gerando chaves de segurança e configurando o serviço");
  await addAppService(run, appDir, secrets);
  ui.ok("Serviço configurado");

  ui.passo("Anexando volume de arquivos");
  await linkService(run, appDir, "app");
  await addVolume(run, appDir, "/data");
  ui.ok("Volume anexado");

  ui.passo("Fazendo o deploy (isso pode levar alguns minutos)");
  await deploy(run, appDir);
  ui.ok("Deploy enviado");

  return obterUrl(ui);
}

export async function atualizar(ui: Ui): Promise<void> {
  ui.passo("Baixando a versão mais recente");
  await downloadCode(appDir);
  ui.ok("Código atualizado");
  ui.passo("Fazendo redeploy no Railway (isso pode levar alguns minutos)");
  await deploy(run, appDir);
  ui.ok("Redeploy enviado");
}

export async function abrirNavegador(url: string): Promise<void> {
  await open(`${url}/setup`).catch(() => {});
}

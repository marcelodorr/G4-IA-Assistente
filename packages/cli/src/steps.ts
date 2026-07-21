import { randomBytes } from "crypto";
import type { Runner } from "./runner.js";

async function exec(run: Runner, cwd: string, args: string[], descricao: string) {
  const res = await run("railway", args, { cwd });
  if (res.code !== 0) {
    throw new Error(`Falha ao ${descricao}: ${res.stderr || res.stdout || `código ${res.code}`}`);
  }
  return res;
}

export async function checkRailway(run: Runner): Promise<{ ok: true } | { ok: false; motivo: "nao-instalada" | "nao-logada" }> {
  if ((await run("railway", ["--version"])).code !== 0) return { ok: false, motivo: "nao-instalada" };
  if ((await run("railway", ["whoami"])).code !== 0) return { ok: false, motivo: "nao-logada" };
  return { ok: true };
}

export function generateSecrets(rand: (n: number) => Buffer = randomBytes) {
  return {
    AUTH_SECRET: rand(32).toString("base64url"),
    ENCRYPTION_KEY: rand(32).toString("hex"),
    DB_PASSWORD: rand(16).toString("hex"),
  };
}

export const createProject = (run: Runner, cwd: string, nome: string) =>
  exec(run, cwd, ["init", "--name", nome], "criar o projeto no Railway");

// o template padrão de Postgres do Railway (PG18) não inclui pgvector — usamos a imagem oficial pgvector
export const addDatabase = (run: Runner, cwd: string, dbPassword: string) =>
  exec(run, cwd, [
    "add", "--image", "pgvector/pgvector:pg17", "--service", "db",
    "--variables", `POSTGRES_PASSWORD=${dbPassword}`,
    "--variables", "POSTGRES_USER=postgres",
    "--variables", "POSTGRES_DB=railway",
    "--variables", "PGDATA=/var/lib/postgresql/data/pgdata",
  ], "provisionar o Postgres (pgvector)");

export const linkService = (run: Runner, cwd: string, nome: string) =>
  exec(run, cwd, ["service", nome], `selecionar o serviço ${nome}`);

export const addAppService = (run: Runner, cwd: string, secrets: { AUTH_SECRET: string; ENCRYPTION_KEY: string; DB_PASSWORD: string }) =>
  exec(run, cwd, [
    "add", "--service", "app",
    "--variables", `AUTH_SECRET=${secrets.AUTH_SECRET}`,
    "--variables", `ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}`,
    "--variables", `DATABASE_URL=postgresql://postgres:${secrets.DB_PASSWORD}@db.railway.internal:5432/railway`,
    "--variables", "DATA_DIR=/data",
    "--variables", "AUTH_TRUST_HOST=true",
  ], "criar o serviço do app");

// pré-requisito: linkService() para o serviço dono do volume — `volume add` não tem flag --service na CLI 5.27
export const addVolume = (run: Runner, cwd: string, mountPath: string) =>
  exec(run, cwd, ["volume", "add", "-m", mountPath], `anexar o volume em ${mountPath}`);

export const deploy = (run: Runner, cwd: string) =>
  exec(run, cwd, ["up", "--service", "app", "--detach"], "fazer o deploy");

export async function getDomain(run: Runner, cwd: string): Promise<string> {
  const res = await exec(run, cwd, ["domain", "--service", "app"], "gerar o domínio público");
  const match = res.stdout.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`Não foi possível identificar a URL no retorno: ${res.stdout}`);
  return match[0].replace(/[),.]$/, "");
}

export async function isLinkedProject(run: Runner, cwd: string): Promise<boolean> {
  return (await run("railway", ["status"], { cwd })).code === 0;
}

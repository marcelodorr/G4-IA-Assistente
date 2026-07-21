import { describe, it, expect } from "vitest";
import { checkRailway, generateSecrets, createProject, addDatabase, addAppService, getDomain, isLinkedProject } from "./steps";

type Call = { cmd: string; args: string[] };

function fakeRunner(script: Record<string, { code: number; stdout?: string; stderr?: string }>) {
  const calls: Call[] = [];
  const run = async (cmd: string, args: string[]) => {
    calls.push({ cmd, args });
    const key = `${cmd} ${args.join(" ")}`;
    const hit = Object.entries(script).find(([k]) => key.startsWith(k));
    return { code: hit?.[1].code ?? 0, stdout: hit?.[1].stdout ?? "", stderr: hit?.[1].stderr ?? "" };
  };
  return { run, calls };
}

describe("checkRailway", () => {
  it("detecta CLI não instalada", async () => {
    const { run } = fakeRunner({ "railway --version": { code: 127 } });
    expect(await checkRailway(run)).toEqual({ ok: false, motivo: "nao-instalada" });
  });
  it("detecta não logado", async () => {
    const { run } = fakeRunner({ "railway --version": { code: 0 }, "railway whoami": { code: 1 } });
    expect(await checkRailway(run)).toEqual({ ok: false, motivo: "nao-logada" });
  });
  it("ok quando instalada e logada", async () => {
    const { run } = fakeRunner({});
    expect(await checkRailway(run)).toEqual({ ok: true });
  });
});

describe("generateSecrets", () => {
  it("gera ENCRYPTION_KEY hex 64, DB_PASSWORD hex 32 e AUTH_SECRET não-vazio", () => {
    const s = generateSecrets();
    expect(s.ENCRYPTION_KEY).toMatch(/^[0-9a-f]{64}$/);
    expect(s.DB_PASSWORD).toMatch(/^[0-9a-f]{32}$/);
    expect(s.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(generateSecrets().ENCRYPTION_KEY).not.toBe(s.ENCRYPTION_KEY);
  });
});

describe("addDatabase", () => {
  it("cria o serviço db com a imagem pgvector e a senha", async () => {
    const { run, calls } = fakeRunner({});
    await addDatabase(run, "/tmp/app", "abc123");
    const args = calls[0].args.join(" ");
    expect(args).toContain("add --image pgvector/pgvector:pg17 --service db");
    expect(args).toContain("POSTGRES_PASSWORD=abc123");
    expect(args).toContain("PGDATA=/var/lib/postgresql/data/pgdata");
  });
});

describe("createProject", () => {
  it("chama railway init com o nome", async () => {
    const { run, calls } = fakeRunner({});
    await createProject(run, "/tmp/app", "meu-assistente");
    expect(calls[0]).toEqual({ cmd: "railway", args: ["init", "--name", "meu-assistente"] });
  });
  it("lança com stderr quando falha", async () => {
    const { run } = fakeRunner({ "railway init": { code: 1, stderr: "boom" } });
    await expect(createProject(run, "/tmp/app", "x")).rejects.toThrow(/boom/);
  });
});

describe("addAppService", () => {
  it("passa todas as variáveis", async () => {
    const { run, calls } = fakeRunner({});
    await addAppService(run, "/tmp/app", { AUTH_SECRET: "s3", ENCRYPTION_KEY: "e".repeat(64), DB_PASSWORD: "abc123" });
    const args = calls[0].args.join(" ");
    expect(args).toContain("add --service app");
    expect(args).toContain("AUTH_SECRET=s3");
    expect(args).toContain(`ENCRYPTION_KEY=${"e".repeat(64)}`);
    expect(args).toContain("DATABASE_URL=postgresql://postgres:abc123@db.railway.internal:5432/railway");
    expect(args).toContain("DATA_DIR=/data");
    expect(args).toContain("AUTH_TRUST_HOST=true");
  });
});

describe("getDomain", () => {
  it("extrai a URL do stdout", async () => {
    const { run } = fakeRunner({ "railway domain": { code: 0, stdout: "Service Domain created:\nhttps://meu-app.up.railway.app\n" } });
    expect(await getDomain(run, "/tmp/app")).toBe("https://meu-app.up.railway.app");
  });
});

describe("isLinkedProject", () => {
  it("true quando railway status funciona", async () => {
    const { run } = fakeRunner({});
    expect(await isLinkedProject(run, "/tmp/app")).toBe(true);
  });
  it("false quando não linkado", async () => {
    const { run } = fakeRunner({ "railway status": { code: 1 } });
    expect(await isLinkedProject(run, "/tmp/app")).toBe(false);
  });
});

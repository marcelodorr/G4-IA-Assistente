import { defineConfig } from "vitest/config";
import { existsSync } from "fs";
import path from "path";

// carrega o .env local (URLs do Postgres de dev no Railway) para os testes
const envFile = path.resolve(__dirname, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "test/**/*.test.ts"],
    // banco remoto (Railway) tem latência maior (~100-200ms/query); a primeira
    // execução também cria o banco g4_test e roda as migrations
    hookTimeout: 30000,
    testTimeout: 30000,
    // os testes de serviço compartilham um único banco remoto (linha id=1 de
    // `settings`) e mutam `process.env.ENCRYPTION_KEY` global — arquivos de
    // teste rodando em paralelo colidem entre si (ver setup.test.ts x
    // settings.test.ts). Roda um arquivo por vez para evitar a corrida.
    fileParallelism: false,
  },
  resolve: { alias: { "@": path.resolve(__dirname) } },
});

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
  },
  resolve: { alias: { "@": path.resolve(__dirname) } },
});

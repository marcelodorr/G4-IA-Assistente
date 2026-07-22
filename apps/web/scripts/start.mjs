import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const requiredEnv = ["DATABASE_URL", "AUTH_SECRET", "ENCRYPTION_KEY"];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  throw new Error(`[start] variáveis obrigatórias ausentes: ${missingEnv.join(", ")}`);
}
if (!/^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY)) {
  throw new Error("[start] ENCRYPTION_KEY deve ter exatamente 64 caracteres hexadecimais");
}

console.log("[start] aplicando migrations...");
const client = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("[start] migrations ok");
} catch (e) {
  if (String(e).includes("vector")) {
    console.error("[start] ERRO: extensão pgvector indisponível neste Postgres. Use uma imagem pgvector/pgvector compatível no Railway ou Dokploy.");
  }
  throw e;
} finally {
  await client.end();
}
await import("./apps/web/server.js");

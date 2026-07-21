import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

console.log("[start] aplicando migrations...");
const client = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("[start] migrations ok");
} catch (e) {
  if (String(e).includes("vector")) {
    console.error("[start] ERRO: extensão pgvector indisponível neste Postgres. Use a imagem pgvector/pgvector ou um Postgres do Railway com pgvector.");
  }
  throw e;
} finally {
  await client.end();
}
await import("./apps/web/server.js");

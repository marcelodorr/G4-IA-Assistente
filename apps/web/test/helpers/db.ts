import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getTestDb() {
  const url = process.env.TEST_DATABASE_URL!;
  if (!testDb) {
    // cria o database g4_test se não existir
    const admin = postgres(url.replace(/\/[^/]+$/, "/postgres"));
    const dbName = url.split("/").pop()!;
    const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (exists.length === 0) await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    await admin.end();
    const client = postgres(url, { max: 3 });
    testDb = drizzle(client, { schema });
    await migrate(testDb, { migrationsFolder: "./drizzle" });
  }
  return testDb;
}

export async function truncateAll() {
  const db = await getTestDb();
  await db.execute(sql`TRUNCATE ai_usage, chat_uploads, users, invites, settings, assistants, assistant_files, chunks, conversations, messages CASCADE`);
}

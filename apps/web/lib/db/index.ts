import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, { max: 10 });
export const db = drizzle(client, { schema });
export type Db = typeof db;
// Tipo do `tx` recebido por `db.transaction(async (tx) => ...)`. `Db` inclui `$client`
// (ausente em `tx`), então serviços chamados dentro de uma transação aceitam `Db | Tx`.
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

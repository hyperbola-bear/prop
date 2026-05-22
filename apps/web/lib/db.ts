import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../packages/db/schema";
import { env } from "./env";

declare global {
  var __proppySqlClient: postgres.Sql | undefined;
}

const databaseUrl = env("DATABASE_URL");

const sqlClient =
  globalThis.__proppySqlClient ??
  postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 5
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__proppySqlClient = sqlClient;
}

export const db = drizzle(sqlClient, { schema });
export { sqlClient };

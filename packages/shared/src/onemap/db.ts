import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@proppy/db";

try {
  process.loadEnvFile(new URL("../../../../.env", import.meta.url));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

declare global {
  var __proppyOneMapSqlClient: postgres.Sql | undefined;
}

type OneMapDb = PostgresJsDatabase<typeof schema>;

let dbInstance: OneMapDb | undefined;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for seed-based OneMap search");
  }
  return databaseUrl;
}

export function getOneMapSqlClient(): postgres.Sql {
  const sqlClient =
    globalThis.__proppyOneMapSqlClient ??
    postgres(getDatabaseUrl(), {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 5
    });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__proppyOneMapSqlClient = sqlClient;
  }

  return sqlClient;
}

export function getOneMapDb(): OneMapDb {
  dbInstance ??= drizzle(getOneMapSqlClient(), { schema });
  return dbInstance;
}

export async function closeOneMapDb(): Promise<void> {
  const sqlClient = globalThis.__proppyOneMapSqlClient;
  if (sqlClient) {
    await sqlClient.end({ timeout: 1 });
    globalThis.__proppyOneMapSqlClient = undefined;
  }
  dbInstance = undefined;
}

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
  var __proppySharedSqlClient: postgres.Sql | undefined;
}

type OtpDb = PostgresJsDatabase<typeof schema>;

let dbInstance: OtpDb | undefined;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to persist OTP codes");
  }
  return databaseUrl;
}

export function getOtpSqlClient(): postgres.Sql {
  const sqlClient =
    globalThis.__proppySharedSqlClient ??
    postgres(getDatabaseUrl(), {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 5
    });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__proppySharedSqlClient = sqlClient;
  }

  return sqlClient;
}

export function getOtpDb(): OtpDb {
  dbInstance ??= drizzle(getOtpSqlClient(), { schema });
  return dbInstance;
}

export async function closeOtpDb(): Promise<void> {
  const sqlClient = globalThis.__proppySharedSqlClient;
  if (sqlClient) {
    await sqlClient.end({ timeout: 1 });
    globalThis.__proppySharedSqlClient = undefined;
  }
  dbInstance = undefined;
}

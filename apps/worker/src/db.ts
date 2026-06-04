import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@proppy/db/schema";
import { readConfig } from "./config";

const config = readConfig();

export const sqlClient = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 5
});

export const db = drizzle(sqlClient, { schema });

export async function closeDb(): Promise<void> {
  await sqlClient.end({ timeout: 5 });
}

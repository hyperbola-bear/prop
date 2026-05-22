import { defineConfig } from "drizzle-kit";

const defaultDatabaseUrl = "postgres://proppy:proppy@localhost:5432/proppy";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl
  },
  out: "./migrations",
  schema: "./schema/index.ts"
});

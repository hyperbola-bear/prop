import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://proppy:proppy@localhost:5432/proppy"
  },
  out: "./migrations",
  schema: "./schema/index.ts"
});

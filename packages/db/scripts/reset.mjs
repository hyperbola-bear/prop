import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

function readEnvDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  try {
    const env = readFileSync(resolve(repoRoot, ".env"), "utf8");
    const line = env
      .split("\n")
      .find((entry) => entry.trim().startsWith("DATABASE_URL="));
    return line?.split("=").slice(1).join("=").trim();
  } catch {
    return undefined;
  }
}

const databaseUrl = readEnvDatabaseUrl();
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set in the environment or repo .env file");
}
const target = new URL(databaseUrl);
const databaseName = target.pathname.replace(/^\//, "");
if (!databaseName) {
  throw new Error("DATABASE_URL must include a database name");
}

target.pathname = "/postgres";
const admin = postgres(target.toString(), { max: 1 });

try {
  await admin`select pg_terminate_backend(pid) from pg_stat_activity where datname = ${databaseName} and pid <> pg_backend_pid()`;
  await admin.unsafe(`drop database if exists "${databaseName.replaceAll('"', '""')}"`);
  await admin.unsafe(`create database "${databaseName.replaceAll('"', '""')}"`);
} finally {
  await admin.end();
}

const result = spawnSync("npm", ["run", "db:migrate"], {
  cwd: resolve(repoRoot, "packages/db"),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "inherit"
});

process.exit(result.status ?? 1);

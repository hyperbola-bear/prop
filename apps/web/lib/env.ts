import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let cachedDotEnv: Record<string, string> | null = null;

function readDotEnv(): Record<string, string> {
  if (cachedDotEnv) {
    return cachedDotEnv;
  }

  try {
    const envPathCandidates = [
      resolve(process.cwd(), ".env"),
      resolve(process.cwd(), "../..", ".env")
    ];
    const envPath = envPathCandidates.find((candidate) => existsSync(candidate));
    const text = envPath ? readFileSync(envPath, "utf8") : "";
    cachedDotEnv = Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const [name, ...value] = line.split("=");
          return [name, value.join("=")];
        })
    );
  } catch {
    cachedDotEnv = {};
  }

  return cachedDotEnv ?? {};
}

export function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? readDotEnv()[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

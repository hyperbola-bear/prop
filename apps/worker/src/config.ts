import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const rootEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env");
dotenv.config({ path: rootEnvPath, quiet: true });

const configSchema = z.object({
  databaseUrl: z.string().min(1),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().positive(),
  smtpFrom: z.string().min(1),
  healthPort: z.coerce.number().int().positive()
});

export type WorkerConfig = z.infer<typeof configSchema>;

export function readConfig(): WorkerConfig {
  return configSchema.parse({
    databaseUrl: process.env.DATABASE_URL ?? "postgres://proppy:proppy@localhost:5432/proppy",
    smtpHost: process.env.SMTP_HOST ?? "localhost",
    smtpPort: process.env.SMTP_PORT ?? "1025",
    smtpFrom: process.env.SMTP_FROM ?? "no-reply@proppy.test",
    healthPort: process.env.WORKER_PORT ?? "3102"
  });
}

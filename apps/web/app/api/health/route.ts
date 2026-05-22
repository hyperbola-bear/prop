import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { healthStatusSchema } from "../../../../../packages/shared/src";
import { sqlClient } from "../../../lib/db";
import { env } from "../../../lib/env";
import { checkPhotoBucket } from "../../../lib/storage";

type CheckStatus = "ok" | "down";

async function checkDb(): Promise<void> {
  await sqlClient`select 1`;
}

async function checkMail(): Promise<void> {
  const transport = nodemailer.createTransport({
    host: env("SMTP_HOST", "localhost"),
    port: Number(env("SMTP_PORT", "1025")),
    connectionTimeout: 1000,
    greetingTimeout: 1000,
    socketTimeout: 1000
  });

  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}

function settledToStatus(result: PromiseSettledResult<void>): CheckStatus {
  return result.status === "fulfilled" ? "ok" : "down";
}

export async function GET() {
  const [dbResult, storageResult, mailResult] = await Promise.allSettled([
    checkDb(),
    checkPhotoBucket(),
    checkMail()
  ]);

  const body = healthStatusSchema.parse({
    status:
      dbResult.status === "fulfilled" &&
      storageResult.status === "fulfilled" &&
      mailResult.status === "fulfilled"
        ? "ok"
        : "degraded",
    db: settledToStatus(dbResult),
    storage: settledToStatus(storageResult),
    mail: settledToStatus(mailResult)
  });

  return NextResponse.json(body, {
    status: body.status === "ok" ? 200 : 503
  });
}

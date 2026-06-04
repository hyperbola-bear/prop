import { NextRequest } from "next/server";
import { createReportSchema } from "../../../../../packages/shared/src/schemas";
import { reports } from "../../../../../packages/db/schema";
import { db } from "../../../lib/db";
import { jsonResponse, mapError, optionsResponse, requireAuth } from "../../../lib/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const body = createReportSchema.parse(await request.json().catch(() => ({})));
    const now = new Date();
    const [created] = await db
      .insert(reports)
      .values({
        reporterUserId: currentUser.userId,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        body: body.body ?? null,
        status: "open",
        createdAt: now,
        updatedAt: now
      })
      .returning({ id: reports.id, status: reports.status });

    if (!created) {
      throw new Error("Report insert failed");
    }

    return jsonResponse(created, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}

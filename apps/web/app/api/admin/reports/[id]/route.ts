import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { reports } from "../../../../../../../packages/db/schema";
import { adminReportStatusSchema } from "../../../../../../../packages/shared/src/schemas";
import { db } from "../../../../../lib/db";
import { jsonResponse, mapError, NotFoundError, optionsResponse, requireRole } from "../../../../../lib/route-helpers";

const reportIdSchema = z.uuid();

type AdminReportRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function PATCH(request: NextRequest, context: AdminReportRouteContext) {
  try {
    const admin = await requireRole(request, "admin");
    const params = await context.params;
    const reportId = reportIdSchema.parse(params.id);
    const body = adminReportStatusSchema.parse(await request.json().catch(() => ({})));
    const now = new Date();

    const [updated] = await db
      .update(reports)
      .set({
        status: body.status,
        resolvedBy: admin.userId,
        resolvedAt: now,
        updatedAt: now
      })
      .where(and(eq(reports.id, reportId), isNull(reports.deletedAt)))
      .returning({
        id: reports.id,
        status: reports.status
      });

    if (!updated) {
      throw new NotFoundError("Report not found");
    }

    return jsonResponse(updated);
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}

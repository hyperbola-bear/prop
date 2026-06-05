import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { sellerPropertyVerifications } from "../../../../../../../../packages/db/schema";
import { db } from "../../../../../../lib/db";
import { jsonResponse, mapError, NotFoundError, optionsResponse, requireRole } from "../../../../../../lib/route-helpers";

const verificationIdSchema = z.uuid();

type AdminVerificationRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: NextRequest, context: AdminVerificationRouteContext) {
  try {
    const admin = await requireRole(request, "admin");
    const params = await context.params;
    const verificationId = verificationIdSchema.parse(params.id);
    const now = new Date();
    const [updated] = await db
      .update(sellerPropertyVerifications)
      .set({
        status: "rejected",
        reviewedBy: admin.userId,
        reviewedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(sellerPropertyVerifications.id, verificationId),
          isNull(sellerPropertyVerifications.deletedAt)
        )
      )
      .returning({
        id: sellerPropertyVerifications.id,
        status: sellerPropertyVerifications.status
      });

    if (!updated) {
      throw new NotFoundError("Verification not found");
    }

    return jsonResponse(updated);
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}

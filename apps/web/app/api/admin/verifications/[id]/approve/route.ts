import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  listings,
  sellerPropertyVerifications
} from "../../../../../../../../packages/db/schema";
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

    const [updated] = await db.transaction(async (tx) => {
      const [verification] = await tx
        .update(sellerPropertyVerifications)
        .set({
          status: "approved",
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
          status: sellerPropertyVerifications.status,
          listingId: sellerPropertyVerifications.listingId
        });

      if (!verification) {
        return [];
      }

      if (verification.listingId) {
        await tx
          .update(listings)
          .set({ sellerOwnershipVerified: true, updatedAt: now })
          .where(eq(listings.id, verification.listingId));
      }

      return [verification];
    });

    if (!updated) {
      throw new NotFoundError("Verification not found");
    }

    return jsonResponse({ id: updated.id, status: updated.status });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}

import { NextRequest } from "next/server";
import { uploadSessions } from "../../../../../../packages/db/schema";
import { presignUploadSchema } from "../../../../../../packages/shared/src/schemas";
import { db } from "../../../../lib/db";
import { requireListingMutationAccess } from "../../../../lib/listing-mutations";
import { jsonResponse, mapError, optionsResponse, requireAuth } from "../../../../lib/route-helpers";
import { presignObjectPutUrl } from "../../../../lib/storage";

const extensionByContentType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf"
};

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const body = presignUploadSchema.parse(await request.json());

    if (body.listingId) {
      await requireListingMutationAccess(body.listingId, currentUser);
    }

    const key = `${body.scope}/${body.listingId ?? currentUser.userId}/${crypto.randomUUID()}${extensionByContentType[body.contentType]}`;
    const url = await presignObjectPutUrl(key, body.contentType);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.insert(uploadSessions).values({
      ownerUserId: currentUser.userId,
      listingId: body.listingId,
      scope: body.scope,
      contentType: body.contentType,
      s3Key: key,
      expiresAt
    });

    return jsonResponse({
      url,
      fields: {},
      key,
      maxSizeBytes: 10 * 1024 * 1024,
      method: "PUT",
      headers: {
        "Content-Type": body.contentType
      }
    });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}

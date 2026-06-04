import { NextRequest } from "next/server";
import { uploadSessions } from "../../../../../../packages/db/schema";
import {
  MAX_UPLOAD_SIZE_BYTES,
  presignUploadSchema
} from "../../../../../../packages/shared/src/schemas";
import { db } from "../../../../lib/db";
import { requireListingMutationAccess } from "../../../../lib/listing-mutations";
import { jsonError, jsonResponse, mapError, optionsResponse, requireAuth } from "../../../../lib/route-helpers";
import { presignObjectPostUrl } from "../../../../lib/storage";

const extensionByContentType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf"
};

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const parsedBody = presignUploadSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      if (parsedBody.error.issues.some((issue) => issue.path[0] === "fileSize")) {
        return jsonError(400, "file_too_large", "Upload exceeds the 10MB limit");
      }
      throw parsedBody.error;
    }
    const body = parsedBody.data;

    if (body.listingId) {
      await requireListingMutationAccess(body.listingId, currentUser);
    }

    const key = `${body.scope}/${body.listingId ?? currentUser.userId}/${crypto.randomUUID()}${extensionByContentType[body.contentType]}`;
    const presign = await presignObjectPostUrl(key, body.contentType);
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
      url: presign.url,
      fields: presign.fields,
      key,
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
      method: "POST"
    });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}

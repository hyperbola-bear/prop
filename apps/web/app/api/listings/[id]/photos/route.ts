import { Buffer } from "node:buffer";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { listingPhotos } from "../../../../../../../packages/db/schema";
import { addListingPhotoSchema } from "../../../../../../../packages/shared/src/schemas";
import { db } from "../../../../../lib/db";
import { requireListingMutationAccess } from "../../../../../lib/listing-mutations";
import { jsonError, jsonResponse, mapError, requireAuth } from "../../../../../lib/route-helpers";
import {
  getStorageObject,
  headStorageObject,
  putStorageObject
} from "../../../../../lib/storage";

const listingIdSchema = z.uuid();
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

type ListingRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function streamBodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new Error("Storage object response body is empty");
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function"
  ) {
    return Buffer.from(
      await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
    );
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function publicMetadata(metadata: sharp.Metadata): Record<string, unknown> {
  return {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    space: metadata.space,
    orientation: metadata.orientation,
    density: metadata.density,
    hasAlpha: metadata.hasAlpha
  };
}

function inferContentType(key: string): string {
  const lowerKey = key.toLowerCase();
  const extension = Object.keys(CONTENT_TYPE_BY_EXTENSION).find((candidate) =>
    lowerKey.endsWith(candidate)
  );
  return extension ? CONTENT_TYPE_BY_EXTENSION[extension]! : "";
}

async function averageHash(buffer: Buffer): Promise<string> {
  const pixels = await sharp(buffer).resize(8, 8, { fit: "fill" }).greyscale().raw().toBuffer();
  const average = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  let bits = 0n;
  for (const pixel of pixels) {
    bits = (bits << 1n) | (pixel >= average ? 1n : 0n);
  }
  return bits.toString(16).padStart(16, "0");
}

export async function POST(request: NextRequest, context: ListingRouteContext) {
  try {
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);
    const currentUser = await requireAuth(request);
    await requireListingMutationAccess(listingId, currentUser);
    const body = addListingPhotoSchema.parse(await request.json());

    const head = await headStorageObject(body.key);
    const contentLength = head.ContentLength ?? 0;
    const contentType = ALLOWED_IMAGE_TYPES.has(head.ContentType ?? "")
      ? head.ContentType ?? ""
      : inferContentType(body.key);
    if (contentLength > MAX_UPLOAD_BYTES) {
      return jsonError(400, "file_too_large", "Uploaded file must be 10MB or smaller");
    }
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return jsonError(400, "unsupported_content_type", "Listing photos must be JPEG, PNG, or WebP");
    }

    const object = await getStorageObject(body.key);
    const imageBuffer = await streamBodyToBuffer(object.Body);
    const metadata = await sharp(imageBuffer).metadata();
    const thumbnailKey = `${body.key}.thumb.webp`;
    const thumbnail = await sharp(imageBuffer).resize(800).webp().toBuffer();
    await putStorageObject(thumbnailKey, thumbnail, "image/webp");
    const phash = await averageHash(imageBuffer);

    const [lastPhoto] = await db
      .select({ sortOrder: listingPhotos.sortOrder })
      .from(listingPhotos)
      .where(and(eq(listingPhotos.listingId, listingId), isNull(listingPhotos.deletedAt)))
      .orderBy(desc(listingPhotos.sortOrder))
      .limit(1);
    const sortOrder = (lastPhoto?.sortOrder ?? -1) + 1;

    const [created] = await db
      .insert(listingPhotos)
      .values({
        listingId,
        s3Key: body.key,
        thumbnailS3Key: thumbnailKey,
        altText: body.altText ?? "Listing photo",
        caption: body.caption,
        sortOrder,
        roomTag: body.roomTag,
        width: metadata.width,
        height: metadata.height,
        perceptualHash: phash,
        exif: publicMetadata(metadata)
      })
      .returning({ id: listingPhotos.id, sortOrder: listingPhotos.sortOrder });

    if (!created) {
      throw new Error("Failed to insert listing photo");
    }

    return jsonResponse({ id: created.id, sortOrder: created.sortOrder }, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}

export async function GET(request: NextRequest, context: ListingRouteContext) {
  try {
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);
    const currentUser = await requireAuth(request);
    await requireListingMutationAccess(listingId, currentUser);
    const photos = await db
      .select({
        id: listingPhotos.id,
        objectPath: listingPhotos.s3Key,
        thumbnailObjectPath: listingPhotos.thumbnailS3Key,
        roomTag: listingPhotos.roomTag,
        sortOrder: listingPhotos.sortOrder
      })
      .from(listingPhotos)
      .where(and(eq(listingPhotos.listingId, listingId), isNull(listingPhotos.deletedAt)))
      .orderBy(asc(listingPhotos.sortOrder));
    return jsonResponse({ items: photos });
  } catch (error) {
    return mapError(error);
  }
}

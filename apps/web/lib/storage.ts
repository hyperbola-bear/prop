import { Buffer } from "node:buffer";
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MAX_UPLOAD_SIZE_BYTES } from "../../../packages/shared/src/schemas";
import { env } from "./env";

let cachedS3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!cachedS3Client) {
    cachedS3Client = new S3Client({
      endpoint: env("S3_ENDPOINT", "http://localhost:9000"),
      region: env("S3_REGION", "us-east-1"),
      credentials: {
        accessKeyId: env("S3_ACCESS_KEY_ID", "minioadmin"),
        secretAccessKey: env("S3_SECRET_ACCESS_KEY", "minioadmin")
      },
      forcePathStyle: true
    });
  }

  return cachedS3Client;
}

export function getPhotoBucket(): string {
  return env("S3_BUCKET", "proppy-photos");
}

export async function presignPhotoGetUrl(objectPath: string): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: getPhotoBucket(),
      Key: objectPath
    }),
    { expiresIn: 900 }
  );
}

export async function presignObjectPutUrl(
  objectPath: string,
  contentType: string
): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new PutObjectCommand({
      Bucket: getPhotoBucket(),
      Key: objectPath,
      ContentType: contentType
    }),
    { expiresIn: 900 }
  );
}

export async function presignObjectPostUrl(
  objectPath: string,
  contentType: string,
  maxSizeBytes = MAX_UPLOAD_SIZE_BYTES
): Promise<{ fields: Record<string, string>; url: string }> {
  return createPresignedPost(getS3Client(), {
    Bucket: getPhotoBucket(),
    Key: objectPath,
    Conditions: [
      ["content-length-range", 0, maxSizeBytes],
      ["eq", "$Content-Type", contentType],
      ["eq", "$key", objectPath]
    ],
    Fields: {
      "Content-Type": contentType
    },
    Expires: 900
  });
}

export async function headStorageObject(objectPath: string) {
  return getS3Client().send(
    new HeadObjectCommand({
      Bucket: getPhotoBucket(),
      Key: objectPath
    })
  );
}

export async function getStorageObject(objectPath: string) {
  return getS3Client().send(
    new GetObjectCommand({
      Bucket: getPhotoBucket(),
      Key: objectPath
    })
  );
}

export async function putStorageObject(
  objectPath: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getPhotoBucket(),
      Key: objectPath,
      Body: body,
      ContentType: contentType
    })
  );
}

export async function checkPhotoBucket(): Promise<void> {
  await getS3Client().send(new HeadBucketCommand({ Bucket: getPhotoBucket() }));
}

import { GetObjectCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

export async function checkPhotoBucket(): Promise<void> {
  await getS3Client().send(new HeadBucketCommand({ Bucket: getPhotoBucket() }));
}

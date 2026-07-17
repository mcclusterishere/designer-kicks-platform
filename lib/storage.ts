import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Upload storage with two drivers:
 *
 * - S3-compatible object storage (AWS S3, Cloudflare R2, Supabase
 *   Storage, Backblaze B2…) when S3_BUCKET + credentials are set.
 *   Required env: S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *   S3_PUBLIC_URL (the public base URL of the bucket/CDN).
 *   Optional: S3_ENDPOINT (required for R2/Supabase/B2), S3_REGION.
 *
 * - Local disk (data/uploads, served via /api/uploads) otherwise —
 *   fine for development and single-server hosts with persistent disk,
 *   wrong for serverless platforms where the filesystem is ephemeral.
 */

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function s3Config() {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const publicUrl = process.env.S3_PUBLIC_URL;
  if (!bucket || !accessKeyId || !secretAccessKey || !publicUrl) return null;
  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    publicUrl: publicUrl.replace(/\/$/, ""),
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "auto",
  };
}

export function objectStorageConfigured(): boolean {
  return s3Config() !== null;
}

/** Stores an upload and returns the URL to save on the record. */
export async function saveUpload(
  data: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const cfg = s3Config();

  if (cfg) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
    const key = `uploads/${fileName}`;
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return `${cfg.publicUrl}/${key}`;
  }

  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_UPLOAD_DIR, fileName), data);
  return `/api/uploads/${fileName}`;
}

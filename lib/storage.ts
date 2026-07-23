import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { uploadDir } from "./uploadDir";

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
  // Every image is re-encoded to a clean JPEG so an iPhone/Safari photo
  // (HEIC, or a mislabeled MIME) can never render blank in Chrome/Firefox.
  // Videos pass through untouched. If we somehow can't decode it, keep the
  // original bytes rather than lose the upload.
  if (contentType.startsWith("image/")) {
    try {
      const { normalizeImage } = await import("./imageNormalize");
      data = await normalizeImage(data);
      contentType = "image/jpeg";
      fileName = fileName.replace(/\.[^.]+$/, "") + ".jpg";
    } catch {
      /* undecodable — fall through with the original bytes */
    }
  } else if (contentType.startsWith("video/")) {
    // Transcode to a universal H.264/AAC MP4 so an iPhone .mov (HEVC) plays
    // on every device, not just Apple's. If ffmpeg is unavailable the
    // original is kept — an upload is never lost over this.
    try {
      const { transcodeToMp4 } = await import("./videoNormalize");
      const mp4 = await transcodeToMp4(data);
      if (mp4) {
        data = mp4;
        contentType = "video/mp4";
        fileName = fileName.replace(/\.[^.]+$/, "") + ".mp4";
      }
    } catch {
      /* keep the original clip */
    }
  }

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

  // No object storage configured → persist in Postgres (bytea). This is
  // the reliable default here: it survives every redeploy without needing
  // a mounted disk volume. Served via /api/uploads/<name>, same as before.
  try {
    const { saveBlob } = await import("./blobStore");
    await saveBlob(fileName, contentType, data);
    return `/api/uploads/${fileName}`;
  } catch {
    // Last-ditch fallback to local disk (e.g. DB unreachable). Better a
    // best-effort write than a lost upload; the DB path is the norm.
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), data);
    return `/api/uploads/${fileName}`;
  }
}

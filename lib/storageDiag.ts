import { readdir, access, writeFile, unlink, stat } from "fs/promises";
import { constants } from "fs";
import path from "path";
import { prisma } from "./db";
import { uploadDir } from "./uploadDir";
import { objectStorageConfigured } from "./storage";
import { blobStats, blobExists } from "./blobStore";

/**
 * A live X-ray of upload storage. Three possible drivers:
 *  - s3:  external object storage (URLs are absolute http…)
 *  - db:  Postgres bytea (the default here — survives redeploys with no
 *         volume). URLs are /api/uploads/<name>, bytes live in UploadBlob.
 *  - local: legacy disk fallback.
 * The important part is the reality check: do the image URLs saved on real
 * records actually resolve to stored bytes? If records point at
 * /api/uploads/… names that aren't in the blob table (and aren't on disk),
 * they 404 for everyone — that's a storage bug, not a codec one.
 */
export type StorageDiag = {
  driver: "s3" | "db" | "local";
  s3?: { bucket: string; publicUrl: string; endpoint: string | null };
  db?: { count: number; totalBytes: number };
  local?: {
    dir: string;
    cwd: string;
    uploadDirEnv: string | null;
    exists: boolean;
    writable: boolean;
    fileCount: number;
  };
  dbCheck: {
    checked: number;
    localUrls: number;
    presentOnDisk: number;
    missingOnDisk: number;
    s3Urls: number;
    seedPublic: number;
    missingSamples: string[];
    presentSample: string | null;
  };
};

export async function storageDiagnostics(): Promise<StorageDiag> {
  const isS3 = objectStorageConfigured();
  const dir = uploadDir();
  const driver: StorageDiag["driver"] = isS3 ? "s3" : "db";
  const diag: StorageDiag = {
    driver,
    dbCheck: {
      checked: 0, localUrls: 0, presentOnDisk: 0, missingOnDisk: 0,
      s3Urls: 0, seedPublic: 0, missingSamples: [], presentSample: null,
    },
  };

  if (isS3) {
    diag.s3 = {
      bucket: process.env.S3_BUCKET || "",
      publicUrl: process.env.S3_PUBLIC_URL || "",
      endpoint: process.env.S3_ENDPOINT || null,
    };
  } else {
    // DB driver stats
    diag.db = await blobStats().catch(() => ({ count: 0, totalBytes: 0 }));

    // Local disk info is still useful (legacy files / fallback writes).
    let exists = false, writable = false, fileCount = 0;
    try {
      await access(dir, constants.F_OK);
      exists = true;
    } catch {}
    if (exists) {
      try {
        const t = path.join(dir, ".write-test");
        await writeFile(t, "ok");
        await unlink(t);
        writable = true;
      } catch {}
      try {
        fileCount = (await readdir(dir)).length;
      } catch {}
    }
    diag.local = {
      dir, cwd: process.cwd(), uploadDirEnv: process.env.UPLOAD_DIR || null,
      exists, writable, fileCount,
    };
  }

  // Reality check: do the URLs on real records resolve to real bytes?
  const subs = await prisma.submission
    .findMany({ select: { imageUrl: true, extraImages: true }, orderBy: { createdAt: "desc" }, take: 80 })
    .catch(() => []);
  const urls: string[] = [];
  for (const s of subs) urls.push(s.imageUrl, ...(s.extraImages || []));
  for (const u of urls) {
    if (!u) continue;
    diag.dbCheck.checked++;
    if (u.startsWith("/api/uploads/")) {
      diag.dbCheck.localUrls++;
      if (isS3) continue; // can't check external store from here
      const name = u.slice("/api/uploads/".length);
      // Present if it's either in the Postgres blob store OR on disk.
      let present = await blobExists(name).catch(() => false);
      if (!present) {
        try {
          await stat(path.join(dir, name));
          present = true;
        } catch {}
      }
      if (present) {
        diag.dbCheck.presentOnDisk++;
        if (!diag.dbCheck.presentSample) diag.dbCheck.presentSample = u;
      } else {
        diag.dbCheck.missingOnDisk++;
        if (diag.dbCheck.missingSamples.length < 5) diag.dbCheck.missingSamples.push(u);
      }
    } else if (u.startsWith("http")) {
      diag.dbCheck.s3Urls++;
    } else if (u.startsWith("/")) {
      diag.dbCheck.seedPublic++;
    }
  }
  return diag;
}

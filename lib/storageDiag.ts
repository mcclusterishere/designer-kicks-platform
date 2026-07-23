import { readdir, access, writeFile, unlink, stat } from "fs/promises";
import { constants } from "fs";
import path from "path";
import { prisma } from "./db";
import { uploadDir } from "./uploadDir";
import { objectStorageConfigured } from "./storage";

/**
 * A live X-ray of upload storage: which driver is active, where local
 * files actually live (and whether that dir exists + is writable + how
 * many files are there), and — the important part — whether the image
 * URLs saved on records actually resolve to real files. If records point
 * at /api/uploads/… paths that aren't on disk, the volume isn't
 * persisting (or points at the wrong path) and every photo 404s for
 * everyone. That's the difference between a codec bug and a storage bug.
 */
export type StorageDiag = {
  driver: "s3" | "local";
  s3?: { bucket: string; publicUrl: string; endpoint: string | null };
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
    // A URL that DID resolve to a real file — rendered as a live test so
    // you can see whether serving works, separate from whether files exist.
    presentSample: string | null;
  };
};

export async function storageDiagnostics(): Promise<StorageDiag> {
  const isS3 = objectStorageConfigured();
  const dir = uploadDir();
  const diag: StorageDiag = {
    driver: isS3 ? "s3" : "local",
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

  // Reality check: do the URLs on real records resolve to real files?
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
      if (isS3) continue; // can't stat S3 from here
      const name = u.slice("/api/uploads/".length);
      try {
        await stat(path.join(dir, name));
        diag.dbCheck.presentOnDisk++;
        if (!diag.dbCheck.presentSample) diag.dbCheck.presentSample = u;
      } catch {
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

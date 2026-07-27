import { readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { normalizeImage } from "./imageNormalize";
import { uploadDir } from "./uploadDir";

const DIR = uploadDir();

/**
 * Fix already-stored photos that Chrome/Firefox can't show — the HEIC
 * files an iPhone slipped in before we started normalizing. Each is
 * re-encoded to a real JPEG IN PLACE (same filename, so every URL already
 * saved on a record keeps working). Files sharp can already decode
 * (JPEG/PNG/WebP/AVIF) are proven browser-safe and left alone; videos are
 * skipped. Idempotent — safe to run on every deploy or on demand.
 */
export async function repairBrokenUploads(): Promise<{
  scanned: number;
  fixed: number;
  skipped: number;
  failed: number;
}> {
  let names: string[] = [];
  try {
    names = await readdir(DIR);
  } catch {
    return { scanned: 0, fixed: 0, skipped: 0, failed: 0 };
  }

  let scanned = 0, fixed = 0, skipped = 0, failed = 0;
  for (const name of names) {
    if (!/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(name)) continue; // images only
    scanned++;
    const full = path.join(DIR, name);
    try {
      const buf = await readFile(full);
      // If sharp can actually decode the pixels, a browser can too — leave it.
      try {
        await sharp(buf).resize(4, 4, { fit: "inside" }).toBuffer();
        skipped++;
        continue;
      } catch {
        /* undecodable by sharp → HEIC (or corrupt); try to convert */
      }
      const jpeg = await normalizeImage(buf); // sharp fails → heic-convert path
      await writeFile(full, jpeg);
      fixed++;
    } catch {
      failed++;
    }
  }
  return { scanned, fixed, skipped, failed };
}

import sharp from "sharp";

/**
 * Re-encode any uploaded image to a clean, universally-decodable JPEG.
 *
 * Why this exists: iPhone/Safari photos are HEIC, which Chrome and Firefox
 * cannot decode at all — they render blank. Safari can, which is why an
 * upload can "work for me" and be invisible to everyone else. Browsers
 * also mislabel a photo's MIME, so we can't trust the type the client
 * sends. Re-encoding server-side to JPEG guarantees the stored bytes are a
 * format every browser renders — and fixes sideways EXIF orientation and
 * runaway dimensions while we're here.
 *
 * sharp handles JPEG/PNG/WebP/GIF/AVIF/TIFF. Apple HEIC (HEVC) isn't in
 * sharp's prebuilt libvips, so when sharp can't decode we fall back to
 * heic-convert (pure WASM, no system codecs) and run the result back
 * through sharp to orient and resize.
 */
export async function normalizeImage(input: Buffer): Promise<Buffer> {
  const toJpeg = (buf: Buffer) =>
    sharp(buf)
      .rotate() // bake in EXIF orientation so nothing shows up sideways
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }) // no black box where alpha used to be
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

  try {
    return await toJpeg(input);
  } catch {
    // sharp couldn't decode it — almost always Apple HEIC. Decode with the
    // WASM path, then re-run through sharp for orientation + sizing.
    const convert = (await import("heic-convert")).default;
    const decoded = Buffer.from(await convert({ buffer: input, format: "JPEG", quality: 0.9 }));
    return await toJpeg(decoded);
  }
}

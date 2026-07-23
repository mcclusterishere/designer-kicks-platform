import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { createReadStream } from "fs";
import { Readable } from "stream";
import path from "path";
import { uploadDir } from "@/lib/uploadDir";
import { readBlob } from "@/lib/blobStore";

const UPLOAD_DIR = uploadDir();
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

// Force Node runtime (Buffers, fs, Prisma) and never cache at the edge —
// bytes come from Postgres now.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  // Uploaded names are uuid.ext — anything else (traversal, odd chars) is out.
  if (!/^[0-9a-f-]{36}\.(jpe?g|png|webp|gif|mp4|mov|webm)$/i.test(name)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const extType = CONTENT_TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range");

  // Primary store: Postgres. Bytes persist across redeploys with no volume.
  const blob = await readBlob(name).catch(() => null);
  if (blob) {
    const type = blob.contentType || extType;
    const isVideo = type.startsWith("video/");
    const size = blob.size || blob.data.length;

    // Range support so Safari plays video and seeking works everywhere.
    if (isVideo && range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
      if (start >= size || end >= size || start > end) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      const chunk = blob.data.subarray(start, end + 1);
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse(new Uint8Array(blob.data), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(size),
        ...(isVideo ? { "Accept-Ranges": "bytes" } : {}),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Fallback: legacy files that may still live on local disk (dev, or the
  // best-effort disk write when the DB was unreachable at upload time).
  const full = path.join(UPLOAD_DIR, name);
  const type = extType;
  const isVideo = type.startsWith("video/");

  let size: number;
  try {
    size = (await stat(full)).size;
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  if (isVideo && range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (start >= size || end >= size || start > end) {
      return new NextResponse("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const stream = Readable.toWeb(createReadStream(full, { start, end })) as unknown as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  try {
    const file = await readFile(full);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(size),
        ...(isVideo ? { "Accept-Ranges": "bytes" } : {}),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

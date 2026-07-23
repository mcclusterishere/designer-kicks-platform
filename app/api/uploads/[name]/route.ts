import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { createReadStream } from "fs";
import { Readable } from "stream";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  // Uploaded names are uuid.ext — anything else (traversal, odd chars) is out.
  if (!/^[0-9a-f-]{36}\.(jpe?g|png|webp|gif|mp4|mov|webm)$/i.test(name)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const full = path.join(UPLOAD_DIR, name);
  const type = CONTENT_TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";
  const isVideo = type.startsWith("video/");

  let size: number;
  try {
    size = (await stat(full)).size;
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  // Videos need HTTP Range support or Safari won't play them (and seeking
  // breaks everywhere). Stream the requested byte range.
  const range = req.headers.get("range");
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

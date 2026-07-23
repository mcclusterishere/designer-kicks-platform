import { spawn } from "child_process";
import { writeFile, readFile, unlink, mkdtemp, rmdir } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

/**
 * Transcode an uploaded clip to a universal H.264 / AAC MP4 (with a
 * faststart moov atom) so it plays on every browser and device. iPhone
 * clips are .mov / HEVC, which desktop Chrome and Firefox can't play; this
 * makes every upload playable everywhere.
 *
 * Requires the ffmpeg binary (added to the Railway build via nixpacks). If
 * ffmpeg is missing or the transcode fails, returns null and the caller
 * keeps the original bytes — an upload is never lost over this.
 */
let ffmpegChecked = false;
let ffmpegOk = false;

async function hasFfmpeg(): Promise<boolean> {
  if (ffmpegChecked) return ffmpegOk;
  ffmpegChecked = true;
  ffmpegOk = await new Promise<boolean>((resolve) => {
    try {
      const p = spawn("ffmpeg", ["-version"]);
      p.on("error", () => resolve(false));
      p.on("close", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
  return ffmpegOk;
}

export async function transcodeToMp4(input: Buffer): Promise<Buffer | null> {
  if (!(await hasFfmpeg())) return null;
  let dir: string | null = null;
  try {
    dir = await mkdtemp(path.join(tmpdir(), "hc-vid-"));
    const inPath = path.join(dir, "in");
    const outPath = path.join(dir, "out.mp4");
    await writeFile(inPath, input);

    const ok = await new Promise<boolean>((resolve) => {
      const p = spawn(
        "ffmpeg",
        [
          "-i", inPath,
          "-vf", "scale='min(1280,iw)':-2", // cap width, keep aspect, even dims
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart",
          "-y", outPath,
        ],
        { stdio: "ignore" }
      );
      p.on("error", () => resolve(false));
      p.on("close", (code) => resolve(code === 0));
    });
    if (!ok) return null;

    const out = await readFile(outPath);
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
    return out;
  } catch {
    return null;
  } finally {
    if (dir) await rmdir(dir).catch(() => {});
  }
}

import path from "path";

/**
 * The single source of truth for where local uploads live. Defaults to
 * <cwd>/data/uploads, but can be pinned with UPLOAD_DIR so it always
 * points at the mounted persistent volume regardless of the process's
 * working directory (Next's standalone server can run from a subdir, which
 * silently moves <cwd>/data off the volume and makes uploads vanish on the
 * next redeploy). Both the writer (saveUpload) and the reader (/api/uploads)
 * import this so they can never disagree.
 */
export function uploadDir(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), "data", "uploads");
}

import { prisma } from "./db";

/**
 * Postgres-backed binary store for user uploads. This is the default
 * persistence driver when S3 object storage isn't configured: files live
 * in the UploadBlob table (bytea) instead of on a local disk volume, so
 * they survive every redeploy. Railway app-service volumes weren't
 * mounting on this project; the Postgres volume is the one thing that
 * reliably persists, so uploads ride along with it.
 *
 * The public URL scheme is unchanged — everything is still served from
 * /api/uploads/<name>, so no saved record needs to be migrated, and
 * flipping to S3/R2 later is purely an env-var change.
 */

export type StoredBlob = {
  data: Buffer;
  contentType: string;
  size: number;
};

/** Persist (or replace) an upload by its uuid.ext filename. */
export async function saveBlob(
  name: string,
  contentType: string,
  data: Buffer
): Promise<void> {
  // Prisma's Bytes field expects a plain Uint8Array (ArrayBuffer-backed),
  // not a Node Buffer, so copy into one.
  const bytes = new Uint8Array(data);
  await prisma.uploadBlob.upsert({
    where: { name },
    create: { name, contentType, size: bytes.length, data: bytes },
    update: { contentType, size: bytes.length, data: bytes },
  });
}

/** Read an upload's bytes + type by filename, or null if it isn't stored. */
export async function readBlob(name: string): Promise<StoredBlob | null> {
  const row = await prisma.uploadBlob
    .findUnique({
      where: { name },
      select: { data: true, contentType: true, size: true },
    })
    .catch(() => null);
  if (!row) return null;
  return {
    data: Buffer.from(row.data),
    contentType: row.contentType,
    size: row.size,
  };
}

/** Whether an upload exists in the store (cheap — no bytes fetched). */
export async function blobExists(name: string): Promise<boolean> {
  const row = await prisma.uploadBlob
    .findUnique({ where: { name }, select: { name: true } })
    .catch(() => null);
  return !!row;
}

/** Count + total bytes held, for the admin storage panel. */
export async function blobStats(): Promise<{ count: number; totalBytes: number }> {
  const [count, agg] = await Promise.all([
    prisma.uploadBlob.count().catch(() => 0),
    prisma.uploadBlob.aggregate({ _sum: { size: true } }).catch(() => ({ _sum: { size: null } })),
  ]);
  return { count, totalBytes: agg._sum.size ?? 0 };
}

import { prisma } from "./db";

/**
 * The same shoe, posted twice.
 *
 * This exists for a specific mess with a specific cause: when uploads were
 * silently failing, artists were told to re-upload — and some did, without
 * deleting the first attempt. The result is two listings for one physical
 * pair, each holding half the photos, splitting the votes between them and
 * making the roster look padded.
 *
 * MERGING HERE DOES NOT DELETE ANYTHING, and that is the whole design.
 *
 * A Submission is the hub of nine relations — votes, battle votes, outfit
 * slots, offers, ratings, consignment, predictions — most cascading on
 * delete, and Battle.subA/subB not cascading at all, so removing a row
 * with any history either destroys that history or leaves a broken
 * battle pointing at nothing. A duplicate that has been in a battle is not
 * a spare copy; it's a record.
 *
 * So a merge does two things: it moves every photo onto the survivor, and
 * it retires the duplicate (REJECTED + hidden) so it leaves the market,
 * the board and the artist's wall. Nothing is destroyed, the votes stay
 * where they were cast, and a mistake is one status change from undone.
 * Hard deletion stays a separate, deliberate act.
 */

/**
 * Two titles are "the same shoe" when they normalise to the same string.
 *
 * Aggressive on purpose about the things people vary between two uploads
 * of one pair — case, punctuation, spacing, a trailing "2"/"v2"/"redo",
 * and the filler words that creep into a second attempt — and completely
 * unwilling to guess beyond that. This only ever proposes; a human picks
 * the survivor and presses the button.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // "(re-upload)", "(new photos)"
    .replace(/\b(re-?upload(ed)?|redo|again|new|updated?|final|v\d+|copy|test)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export type DupeCandidate = {
  id: string;
  title: string;
  status: string;
  imageUrl: string;
  photoCount: number;
  votes: number;
  createdAt: Date;
  /** Locked out of merging, with the reason — a piece that isn't ours to touch. */
  locked: string | null;
};

export type DupeGroup = {
  key: string;
  artistId: string;
  artistName: string;
  pieces: DupeCandidate[];
};

/**
 * Groups of pieces by one artist that look like the same shoe.
 *
 * Scoped to a single artist deliberately: two different makers customising
 * the same silhouette with the same obvious name is a coincidence, not a
 * duplicate, and merging across artists would erase someone's authorship.
 */
export async function findDuplicatePieces(artistId?: string): Promise<DupeGroup[]> {
  const rows = await prisma.submission.findMany({
    where: artistId ? { artistId } : { artistId: { not: null } },
    select: {
      id: true,
      title: true,
      status: true,
      imageUrl: true,
      extraImages: true,
      createdAt: true,
      artistId: true,
      ownerId: true,
      artist: { select: { displayName: true } },
      _count: { select: { votes: true } },
      sales: { where: { status: "CONFIRMED" }, select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.artistId) continue;
    const norm = normalizeTitle(r.title);
    if (!norm) continue; // a title that normalises to nothing can't be matched safely
    const key = `${r.artistId}::${norm}`;
    const list = buckets.get(key) ?? [];
    list.push(r);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({
      key,
      artistId: list[0].artistId!,
      artistName: list[0].artist?.displayName ?? "Unknown artist",
      pieces: list.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        imageUrl: r.imageUrl,
        photoCount: 1 + r.extraImages.length,
        votes: r._count.votes,
        createdAt: r.createdAt,
        locked: r.ownerId
          ? "A collector owns this one"
          : r.sales.length > 0
            ? "This one has a confirmed sale"
            : null,
      })),
    }))
    .sort((a, b) => b.pieces.length - a.pieces.length);
}

export type MergeResult =
  | { ok: true; survivorId: string; photosAdded: number; retired: number }
  | { ok: false; error: string };

/**
 * Fold duplicates into one listing.
 *
 * Photos are unioned rather than replaced, because the duplicates exist
 * precisely BECAUSE the first upload's photos were broken — the newer row
 * often holds the only working images, and the older one holds the votes.
 * Taking pictures from one and history from the other is the entire point.
 */
export async function mergePieces(
  survivorId: string,
  duplicateIds: string[],
  maxPhotos = 12
): Promise<MergeResult> {
  const ids = [...new Set(duplicateIds)].filter((id) => id && id !== survivorId);
  if (ids.length === 0) return { ok: false, error: "Pick at least one duplicate to fold in." };

  const survivor = await prisma.submission.findUnique({
    where: { id: survivorId },
    select: { id: true, artistId: true, imageUrl: true, extraImages: true, title: true },
  });
  if (!survivor?.artistId) return { ok: false, error: "Survivor piece not found." };

  const dupes = await prisma.submission.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, artistId: true, imageUrl: true, extraImages: true,
      ownerId: true, sales: { where: { status: "CONFIRMED" }, select: { id: true }, take: 1 },
    },
  });
  if (dupes.length !== ids.length) return { ok: false, error: "One of those pieces no longer exists." };

  // Never across artists — that would erase somebody's authorship.
  if (dupes.some((d) => d.artistId !== survivor.artistId)) {
    return { ok: false, error: "Those pieces belong to different artists. Merging stops at the artist line." };
  }
  // Never a piece that has already moved on. The maker's copy is not the
  // collector's copy, even when they look identical.
  const held = dupes.find((d) => d.ownerId || d.sales.length > 0);
  if (held) {
    return {
      ok: false,
      error: "One of those is owned by a collector or has a confirmed sale — retiring it would erase their record.",
    };
  }

  // Union every photo, survivor's cover first, in a stable order.
  const seen = new Set<string>();
  const all: string[] = [];
  for (const url of [survivor.imageUrl, ...survivor.extraImages, ...dupes.flatMap((d) => [d.imageUrl, ...d.extraImages])]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    all.push(url);
  }
  const cover = all[0];
  const extras = all.slice(1, maxPhotos);
  const photosAdded = extras.length - survivor.extraImages.length;

  await prisma.$transaction([
    prisma.submission.update({
      where: { id: survivor.id },
      data: { imageUrl: cover, extraImages: extras },
    }),
    // Retired, not deleted. See the note at the top of this file.
    prisma.submission.updateMany({
      where: { id: { in: ids } },
      data: { status: "REJECTED", closetHidden: true, askingPriceCents: null },
    }),
  ]);

  return { ok: true, survivorId: survivor.id, photosAdded: Math.max(0, photosAdded), retired: ids.length };
}

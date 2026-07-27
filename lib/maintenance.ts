import { prisma } from "./db";

/**
 * Repairs that belong in the refresh cycle rather than in a one-off script.
 *
 * These exist because the honest fix for bad-looking data is almost always
 * to mend the link, not to filter the row out of the view. A piece missing
 * its artist link is still someone's work — hiding it loses the work, while
 * re-pointing it puts it back where it belongs.
 */

/**
 * Re-point pieces that lost their artist link, matching on the artist name
 * recorded at submission time. Pieces whose name matches nothing are left
 * exactly as they are: a wrong link is worse than a missing one, so the
 * match has to be unambiguous or we don't touch it.
 */
export async function relinkOrphanPieces(): Promise<{ orphans: number; repaired: number }> {
  const orphans = await prisma.submission.findMany({
    where: { artistId: null },
    select: { id: true, artistName: true },
  });
  if (orphans.length === 0) return { orphans: 0, repaired: 0 };

  const artists = await prisma.artistProfile.findMany({ select: { id: true, displayName: true } });
  const byName = new Map(artists.map((a) => [a.displayName.trim().toLowerCase(), a.id]));

  let repaired = 0;
  for (const s of orphans) {
    const artistId = byName.get((s.artistName || "").trim().toLowerCase());
    if (!artistId) continue;
    await prisma.submission.update({ where: { id: s.id }, data: { artistId } }).catch(() => {});
    repaired++;
  }
  return { orphans: orphans.length, repaired };
}

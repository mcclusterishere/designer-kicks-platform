import { prisma } from "./db";

/**
 * Fill the calendar backwards, using only dates we can actually stand behind.
 *
 * The drop calendar only knew about the future. Every article we'd written
 * about a pair that already dropped sat with no date on it, so the months
 * behind today were empty and there was nothing to browse — which is a
 * waste of the archive and a waste of the reason somebody would put this
 * calendar on their phone in the first place.
 *
 * The temptation is to guess. Do not. A sneaker calendar that is wrong
 * about a release date is worse than a sneaker calendar that is empty,
 * because the audience knows the real dates and will catch it instantly.
 *
 * So the only source is a SKU match against the catalog, where the release
 * date came from the SKU feed rather than from us. An article that names a
 * SKU we hold a real release date for gets that exact date. Everything else
 * stays undated and keeps sitting on the radar until a date lands. That
 * makes this safe to re-run forever: coverage grows as the catalog grows,
 * and it never invents a day.
 */

export type BackfillResult = {
  scanned: number;
  dated: number;
  entries: { slug: string; sku: string; dropAt: string }[];
};

export async function backfillDropHistory(dryRun = false): Promise<BackfillResult> {
  const undated = await prisma.article.findMany({
    where: { status: "PUBLISHED", dropAt: null, sku: { not: null } },
    select: { id: true, slug: true, sku: true },
  });
  if (undated.length === 0) return { scanned: 0, dated: 0, entries: [] };

  const skus = undated.map((a) => a.sku!).filter(Boolean);
  const shoes = await prisma.catalogShoe.findMany({
    where: { sku: { in: skus }, releaseDate: { not: null } },
    select: { sku: true, releaseDate: true },
  });
  const dateBySku = new Map(shoes.map((s) => [s.sku, s.releaseDate!]));

  const entries: BackfillResult["entries"] = [];
  for (const a of undated) {
    const at = dateBySku.get(a.sku!);
    if (!at) continue;
    entries.push({ slug: a.slug, sku: a.sku!, dropAt: at.toISOString().slice(0, 10) });
    if (!dryRun) {
      await prisma.article.update({
        where: { id: a.id },
        // dropSource records WHERE the date came from, so a human reading
        // the row later can tell a catalog-derived date from one somebody
        // typed in by hand.
        data: { dropAt: at, dropSource: "catalog", dropCheckedAt: new Date() },
      });
    }
  }
  return { scanned: undated.length, dated: entries.length, entries };
}

/**
 * Which months actually hold something, so browsing backwards is a
 * decision rather than a guess. Without this the calendar has arrows that
 * lead into a dozen empty months and no way to know which are worth a tap.
 */
export async function monthsWithDrops(): Promise<{ month: string; count: number }[]> {
  const rows = await prisma.$queryRawUnsafe<{ month: string; count: bigint }[]>(
    `select to_char("dropAt", 'YYYY-MM') as month, count(*) as count
       from "Article"
      where "dropAt" is not null and status = 'PUBLISHED'
      group by 1
     union all
     select to_char("dropAt", 'YYYY-MM') as month, count(*) as count
       from "ArtistDrop"
      where "dropAt" is not null and status = 'APPROVED'
      group by 1`
  );
  const merged = new Map<string, number>();
  for (const r of rows) {
    merged.set(r.month, (merged.get(r.month) ?? 0) + Number(r.count));
  }
  return [...merged.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

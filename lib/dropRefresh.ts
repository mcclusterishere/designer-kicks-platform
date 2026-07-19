/**
 * Drop-date sync — walks every article that carries a style code (SKU),
 * asks the sneaker-API waterfall for its release date, and updates the
 * calendar when a trustworthy source has a newer/different date.
 *
 * The authority rule (the "hardest part" — normalization):
 *   - A date may only be overwritten by an equal-or-higher-authority
 *     source than the one that set the current date.
 *   - "manual" (a human editing the article) outranks every API, so an
 *     editor's date is never stomped by a scraper.
 *   - We stamp dropCheckedAt on every look, even when nothing changed, so
 *     the admin can see the calendar is being watched.
 *
 * Rate limits: free tiers throttle at ~1 req/sec, so we pause 2s between
 * SKUs. This runs from a cron (daily is plenty for a release calendar —
 * cached data 24h old is fine) or the admin "Refresh now" button.
 */
import { prisma } from "@/lib/db";
import { getReleaseDate, authorityOf, sneakerApiLive, providersConfigured } from "@/lib/sneakerApi";

const DELAY_MS = 2000;
const DAY_MS = 86_400_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type DropRefreshChange = {
  slug: string;
  title: string;
  from: string | null;
  to: string;
  source: string;
};

export type DropRefreshSummary = {
  providersLive: boolean;
  providers: { kicksdb: boolean; stockx: boolean; apify: boolean };
  checked: number;
  updated: number;
  unchanged: number;
  notFound: number;
  skippedManual: number;
  changes: DropRefreshChange[];
  ranAt: string;
};

/**
 * @param opts.onlyFuture  only sync drops that haven't happened yet (default true)
 * @param opts.limit       cap how many SKUs to hit this run (protects free quotas)
 */
export async function refreshDropDates(opts?: {
  onlyFuture?: boolean;
  limit?: number;
}): Promise<DropRefreshSummary> {
  const onlyFuture = opts?.onlyFuture ?? true;
  const limit = opts?.limit ?? 50;
  const providers = providersConfigured();
  const summary: DropRefreshSummary = {
    providersLive: sneakerApiLive(),
    providers,
    checked: 0,
    updated: 0,
    unchanged: 0,
    notFound: 0,
    skippedManual: 0,
    changes: [],
    ranAt: new Date().toISOString(),
  };

  // Dormant until a provider key is configured — no outbound calls.
  if (!summary.providersLive) return summary;

  const articles = await prisma.article.findMany({
    where: {
      sku: { not: null },
      // "Future only" still includes dateless SKUs — the sync can fill in a
      // date the article doesn't have yet, it just won't re-chase old drops.
      ...(onlyFuture
        ? { OR: [{ dropAt: null }, { dropAt: { gte: new Date(Date.now() - DAY_MS) } }] }
        : {}),
    },
    select: { id: true, slug: true, title: true, sku: true, dropAt: true, dropSource: true },
    orderBy: { dropAt: "asc" },
    take: limit,
  });

  for (const a of articles) {
    if (!a.sku) continue;
    summary.checked++;

    const hit = await getReleaseDate(a.sku).catch(() => null);
    const checkedAt = new Date();

    if (!hit) {
      summary.notFound++;
      await prisma.article.update({ where: { id: a.id }, data: { dropCheckedAt: checkedAt } });
      await sleep(DELAY_MS);
      continue;
    }

    // Authority gate: only an equal-or-higher source may move the date.
    const incoming = authorityOf(hit.source);
    const current = authorityOf(a.dropSource);
    const sameDay =
      a.dropAt && Math.abs(hit.releaseDate.getTime() - a.dropAt.getTime()) < DAY_MS;

    if (a.dropSource === "manual" && hit.source !== "manual") {
      summary.skippedManual++;
      await prisma.article.update({ where: { id: a.id }, data: { dropCheckedAt: checkedAt } });
    } else if (!sameDay && incoming >= current) {
      // Normalize to noon UTC like the rest of the calendar stores dates.
      const iso = hit.releaseDate.toISOString().slice(0, 10);
      const normalized = new Date(`${iso}T12:00:00Z`);
      summary.updated++;
      summary.changes.push({
        slug: a.slug,
        title: a.title,
        from: a.dropAt ? a.dropAt.toISOString().slice(0, 10) : null,
        to: iso,
        source: hit.source,
      });
      await prisma.article.update({
        where: { id: a.id },
        data: { dropAt: normalized, dropSource: hit.source, dropCheckedAt: checkedAt },
      });
    } else {
      summary.unchanged++;
      await prisma.article.update({
        where: { id: a.id },
        // A confirming look from a source at least as authoritative re-stamps ownership.
        data: {
          dropCheckedAt: checkedAt,
          ...(sameDay && incoming >= current && !a.dropSource ? { dropSource: hit.source } : {}),
        },
      });
    }

    await sleep(DELAY_MS);
  }

  return summary;
}

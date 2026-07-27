import { prisma } from "./db";

/**
 * The handoff — getting a piece from the maker to the person who bought
 * it, on the record.
 *
 * This is the single most important unfinished transaction on the site,
 * and until now it had no owner in the software. A sale was recorded and
 * then sat PENDING forever, because the only thing that could move it
 * was the buyer clicking a link nobody had sent them.
 *
 * Everything downstream depends on this step completing. No claim means
 * no owner; no owner means no collector page, no provenance, and nothing
 * anybody can resell — which is why the market only ever shows first
 * sales from makers and never a piece changing hands a second time.
 * The resale flywheel doesn't have a demand problem, it has never been
 * given a single completed cycle to start from.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A sale still waiting on its buyer, with everything needed to chase it. */
export type PendingHandoff = {
  saleId: string;
  title: string;
  imageUrl: string;
  buyerEmail: string;
  priceCents: number;
  soldAt: Date;
  daysWaiting: number;
  /** Past the point where a polite nudge is overdue. */
  stale: boolean;
  claimUrl: string;
};

export function claimUrl(saleId: string, base: string): string {
  return `${base.replace(/\/$/, "")}/claim/${saleId}`;
}

/**
 * Sales this artist has recorded that nobody has claimed yet.
 *
 * Sorted oldest first: the ones most likely to be forgotten are the ones
 * that need the message.
 */
export async function pendingHandoffs(
  artistId: string,
  base: string
): Promise<PendingHandoff[]> {
  const sales = await prisma.sale.findMany({
    where: { status: "PENDING", submission: { artistId } },
    orderBy: { soldAt: "asc" },
    select: {
      id: true,
      buyerEmail: true,
      priceCents: true,
      soldAt: true,
      submission: { select: { title: true, imageUrl: true } },
    },
  });

  const now = Date.now();
  return sales.map((s) => {
    const daysWaiting = Math.max(0, Math.round((now - s.soldAt.getTime()) / DAY));
    return {
      saleId: s.id,
      title: s.submission.title,
      imageUrl: s.submission.imageUrl,
      buyerEmail: s.buyerEmail,
      priceCents: s.priceCents,
      soldAt: s.soldAt,
      daysWaiting,
      // Three days is long enough that the email has been seen or missed,
      // and short enough that the sale is still fresh in the buyer's mind.
      stale: daysWaiting >= 3,
      claimUrl: claimUrl(s.id, base),
    };
  });
}

/**
 * A message the artist can paste straight into a DM.
 *
 * Written in a maker's voice rather than a platform's, because it's
 * going to be sent from their account to someone who bought from them
 * personally. A message that reads like marketing copy doesn't get sent.
 */
export function handoffMessage(opts: {
  title: string;
  artistName: string;
  claimUrl: string;
}): string {
  return [
    `Yo — thanks again for copping "${opts.title}".`,
    ``,
    `Claim it here so it's officially logged as yours:`,
    opts.claimUrl,
    ``,
    `Takes a minute, it's free, and it puts the piece in your closet with the provenance on it — proof you own the only one. You can resell it off there later if you ever want to.`,
    ``,
    `— ${opts.artistName}`,
  ].join("\n");
}

/** How the handoff is going overall, for the artist's own dashboard. */
export async function handoffStats(artistId: string) {
  const [pending, claimed, pieces] = await Promise.all([
    prisma.sale.count({ where: { status: "PENDING", submission: { artistId } } }),
    prisma.sale.count({ where: { status: "CONFIRMED", submission: { artistId } } }),
    prisma.submission.count({ where: { artistId, status: "APPROVED" } }),
  ]);
  const total = pending + claimed;
  return {
    pending,
    claimed,
    pieces,
    claimRatePct: total > 0 ? Math.round((claimed / total) * 100) : 0,
  };
}

/**
 * Every unclaimed sale across the platform, oldest first — the admin's
 * version, for chasing the ones an artist won't.
 */
export async function allPendingHandoffs(base: string, staleDays = 3) {
  const sales = await prisma.sale.findMany({
    where: { status: "PENDING" },
    orderBy: { soldAt: "asc" },
    take: 100,
    select: {
      id: true,
      buyerEmail: true,
      priceCents: true,
      soldAt: true,
      submission: {
        select: { title: true, artistName: true, artist: { select: { slug: true } } },
      },
    },
  });
  const now = Date.now();
  return sales.map((s) => {
    const daysWaiting = Math.max(0, Math.round((now - s.soldAt.getTime()) / DAY));
    return {
      saleId: s.id,
      title: s.submission.title,
      artistName: s.submission.artistName,
      artistSlug: s.submission.artist?.slug ?? null,
      buyerEmail: s.buyerEmail,
      priceCents: s.priceCents,
      daysWaiting,
      stale: daysWaiting >= staleDays,
      claimUrl: claimUrl(s.id, base),
    };
  });
}

/**
 * The email a buyer gets. Lives here rather than inline at the call site
 * because it is sent from two places — the moment a sale is recorded,
 * and again when the artist chases it — and two copies of a message
 * drift apart the first time one of them is edited.
 */
export function buyerClaimEmail(opts: {
  title: string;
  sellerName: string;
  priceCents: number;
  claimUrl: string;
  reminder?: boolean;
}): { subject: string; text: string } {
  const price = (opts.priceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const subject = opts.reminder
    ? `Reminder: claim "${opts.title}" on The Heat Chart`
    : `${opts.sellerName} sent you "${opts.title}" — claim it on The Heat Chart`;

  const text = [
    opts.reminder
      ? `${opts.sellerName} is still waiting on you to claim "${opts.title}".`
      : `${opts.sellerName} recorded selling you "${opts.title}" for ${price}.`,
    ``,
    `Claim it here and the piece is officially yours:`,
    opts.claimUrl,
    ``,
    `It takes a minute and it's free. What you get:`,
    `  \u00b7 the piece in your closet, on a collector page with your name on it`,
    `  \u00b7 verified provenance \u2014 the record shows you own this exact one-of-one`,
    `  \u00b7 the ability to resell it on the market whenever you want`,
    ``,
    `If you didn't buy this, ignore this email and nothing happens.`,
    ``,
    `\u2014 The Heat Chart`,
  ].join("\n");

  return { subject, text };
}

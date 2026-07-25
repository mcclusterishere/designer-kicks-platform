import { prisma } from "./db";
import { siteUrl } from "./articles";

/**
 * The drip feed: existing content, released into each platform at that
 * platform's pace and in that platform's voice.
 *
 * Three ideas hold this together.
 *
 * ONE POST PER PLACE, NOT ONE POST EVERYWHERE. The same custom is a
 * different post on Reddit than on X. Reddit's sneaker communities are
 * hostile to anything that reads like marketing and generous to anything
 * that leads with the maker and the work; X rewards a hook and an image.
 * Blasting identical copy to both is how an account gets filtered on one
 * and ignored on the other, so copy is rendered per platform and stored,
 * which also means a human can read exactly what will go out.
 *
 * THE DESTINATION'S RULES ARE DATA. Every subreddit worth being in enforces
 * a policy, and the good ones ban precisely what a naive feed does: brand
 * names in titles, affiliate links, bulk posting. Those rules live on the
 * target record and are checked before anything is scheduled. A post that
 * would break one is stored BLOCKED with the reason rather than sent — a
 * banned account distributes nothing, which makes following the rules the
 * high-throughput strategy, not the timid one.
 *
 * PACE IS PER DESTINATION. minHoursBetween and maxPerWeek are the
 * anti-spam rules turned into scheduling arithmetic, so the queue physically
 * cannot post faster than a place tolerates.
 */

export type SourceKind = "ARTICLE" | "PIECE" | "BATTLE" | "SHOE";
export type Platform = "REDDIT" | "X" | "BLUESKY" | "TELEGRAM" | "DISCORD";

export type Rendered = {
  title: string;
  body?: string;
  link?: string;
  mediaUrl?: string;
};

/** Words that read as an ad to a moderator scanning titles. */
const PROMO_MARKERS = [
  "the heat chart", "theheatchart", "heat chart",
  "check out", "check us out", "join us", "sign up", "vote now",
  "our site", "our platform", "we built", "we launched", "my site",
  "link in bio", "click here", "free to join",
];

const AFFILIATE_MARKERS = ["/go?", "/go/", "tag=", "campid", "affiliate", "utm_medium=affiliate", "ebay.com/itm"];

export type Violation = { rule: string; detail: string };

/**
 * Check one rendered post against one destination's stated rules.
 *
 * Returns every violation rather than the first, so whoever is reviewing
 * sees the whole picture instead of fixing one thing at a time.
 */
export function checkCompliance(
  post: Rendered,
  target: {
    allowLinks: boolean;
    allowSelfPromo: boolean;
    allowAffiliate: boolean;
    requireFlair: boolean;
  },
  flair?: string | null
): Violation[] {
  const out: Violation[] = [];
  const title = post.title.toLowerCase();
  const haystack = `${title} ${(post.body ?? "").toLowerCase()}`;

  if (!target.allowSelfPromo) {
    const hit = PROMO_MARKERS.find((m) => title.includes(m));
    if (hit) {
      out.push({
        rule: "no self-promo in titles",
        detail: `title contains "${hit}" — lead with the maker and the work instead`,
      });
    }
  }

  if (!target.allowLinks && post.link) {
    out.push({
      rule: "no link posts",
      detail: "this destination takes text/image posts only",
    });
  }

  if (!target.allowAffiliate) {
    const hit = AFFILIATE_MARKERS.find((m) => (post.link ?? "").toLowerCase().includes(m) || haystack.includes(m));
    if (hit) {
      out.push({ rule: "no affiliate links", detail: `contains "${hit}"` });
    }
  }

  if (target.requireFlair && !flair?.trim()) {
    out.push({ rule: "flair required", detail: "pick a flair before this can be queued" });
  }

  if (!post.title.trim()) out.push({ rule: "empty title", detail: "nothing to post" });
  if (post.title.length > 300) out.push({ rule: "title too long", detail: `${post.title.length}/300` });

  return out;
}

/* ---------------- per-platform rendering ---------------- */

type PieceSource = {
  id: string;
  title: string;
  artistName: string;
  baseShoe: string;
  imageUrl: string;
  description: string | null;
  artist: { slug: string } | null;
};

type ArticleSource = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
};

/**
 * A custom, as each platform wants to read it.
 *
 * The Reddit variant is the one that matters most and looks least like
 * marketing: the maker's name and the donor pair, which is exactly what
 * somebody scrolling r/customsneakers came to see. No brand, no call to
 * action, and the image is the post — the link goes in a comment later if
 * anyone asks, which is the convention those communities actually accept.
 */
export function renderPiece(p: PieceSource, platform: Platform): Rendered {
  const base = siteUrl();
  const link = p.artist ? `${base}/artists/${p.artist.slug}` : base;
  const cleanDesc = (p.description ?? "").trim().slice(0, 300);

  switch (platform) {
    case "REDDIT":
      return {
        // Maker + what it is. Reads like a person sharing work, because
        // that's what it is.
        title: `${p.title} — hand-finished ${p.baseShoe} by ${p.artistName}`,
        body: cleanDesc || undefined,
        mediaUrl: p.imageUrl,
        // No link. Self-promo and affiliate rules bite hardest here, and an
        // image post from a named maker is what these subs upvote anyway.
      };
    case "X":
      return {
        title: `${p.title}\n\n${p.baseShoe}, reworked by ${p.artistName}.${cleanDesc ? `\n\n${cleanDesc.slice(0, 120)}` : ""}`,
        link,
        mediaUrl: p.imageUrl,
      };
    case "BLUESKY":
      return {
        title: `${p.title} — a one-of-one ${p.baseShoe} by ${p.artistName}.`,
        link,
        mediaUrl: p.imageUrl,
      };
    default:
      return {
        title: `${p.title} by ${p.artistName}`,
        body: cleanDesc || undefined,
        link,
        mediaUrl: p.imageUrl,
      };
  }
}

/**
 * An article. Reddit gets the finding, not the headline — a release date or
 * a price fact is a contribution; a headline with our name on it is an ad.
 */
export function renderArticle(a: ArticleSource, platform: Platform): Rendered {
  const link = `${siteUrl()}/news/${a.slug}`;
  switch (platform) {
    case "REDDIT":
      return {
        title: a.title.replace(/\s*\|\s*The Heat Chart\s*$/i, "").trim(),
        body: `${a.excerpt}\n\n(Full dates and pricing in the source — happy to paste the details in a comment if that's easier.)`,
        link,
        mediaUrl: a.coverImage ?? undefined,
      };
    case "X":
      return { title: `${a.title}\n\n${a.excerpt.slice(0, 150)}`, link, mediaUrl: a.coverImage ?? undefined };
    case "BLUESKY":
      return { title: `${a.title} — ${a.excerpt.slice(0, 180)}`, link, mediaUrl: a.coverImage ?? undefined };
    default:
      return { title: a.title, body: a.excerpt, link, mediaUrl: a.coverImage ?? undefined };
  }
}

/* ---------------- scheduling ---------------- */

/**
 * The next slot at a destination that respects both its pace rules.
 *
 * Starts from whichever is later — now, or one gap after the last thing we
 * posted there — then walks forward until the trailing week has room. This
 * is the anti-bulk-posting rule expressed as arithmetic, so the queue
 * cannot outrun what a place tolerates even if somebody queues 200 items.
 */
export async function nextSlot(targetId: string): Promise<Date> {
  const target = await prisma.socialTarget.findUniqueOrThrow({ where: { id: targetId } });
  const gapMs = Math.max(1, target.minHoursBetween) * 3600_000;

  const last = await prisma.socialPost.findFirst({
    where: { targetId, status: { in: ["QUEUED", "POSTED"] } },
    orderBy: { scheduledFor: "desc" },
    select: { scheduledFor: true },
  });

  let at = new Date(Math.max(Date.now() + 60_000, (last?.scheduledFor.getTime() ?? 0) + gapMs));

  // Respect the weekly ceiling by pushing past the oldest post in the window.
  for (let guard = 0; guard < 200; guard++) {
    const weekStart = new Date(at.getTime() - 7 * 86400_000);
    const inWindow = await prisma.socialPost.findMany({
      where: { targetId, status: { in: ["QUEUED", "POSTED"] }, scheduledFor: { gt: weekStart, lte: at } },
      orderBy: { scheduledFor: "asc" },
      select: { scheduledFor: true },
    });
    if (inWindow.length < Math.max(1, target.maxPerWeek)) return at;
    at = new Date(inWindow[0].scheduledFor.getTime() + 7 * 86400_000 + 60_000);
  }
  return at;
}

export type QueueOutcome = {
  queued: number;
  blocked: number;
  duplicates: number;
  details: { source: string; status: string; note: string; when?: string }[];
};

/**
 * Fill a destination's queue from content that already exists.
 *
 * Skips anything already queued there — the unique constraint on
 * (target, sourceKind, sourceId) is the backstop, but checking first means
 * the report says "already queued" rather than swallowing an error.
 */
export async function fillQueue(
  targetId: string,
  kind: SourceKind,
  limit = 10
): Promise<QueueOutcome> {
  const target = await prisma.socialTarget.findUniqueOrThrow({ where: { id: targetId } });
  const platform = target.platform as Platform;
  const out: QueueOutcome = { queued: 0, blocked: 0, duplicates: 0, details: [] };

  const already = new Set(
    (
      await prisma.socialPost.findMany({
        where: { targetId, sourceKind: kind },
        select: { sourceId: true },
      })
    ).map((r) => r.sourceId)
  );

  const items: { id: string; rendered: Rendered }[] = [];

  if (kind === "PIECE") {
    const pieces = await prisma.submission.findMany({
      where: { status: "APPROVED", id: { notIn: [...already] } },
      orderBy: { createdAt: "desc" },
      take: limit * 2,
      select: {
        id: true, title: true, artistName: true, baseShoe: true, imageUrl: true,
        description: true, artist: { select: { slug: true } },
      },
    });
    for (const p of pieces) items.push({ id: p.id, rendered: renderPiece(p, platform) });
  } else if (kind === "ARTICLE") {
    const articles = await prisma.article.findMany({
      where: { status: "PUBLISHED", id: { notIn: [...already] } },
      orderBy: { publishedAt: "desc" },
      take: limit * 2,
      select: { id: true, slug: true, title: true, excerpt: true, coverImage: true },
    });
    for (const a of articles) items.push({ id: a.id, rendered: renderArticle(a, platform) });
  }

  for (const item of items) {
    if (out.queued + out.blocked >= limit) break;
    if (already.has(item.id)) {
      out.duplicates++;
      continue;
    }

    const violations = checkCompliance(item.rendered, target, null);
    const blocked = violations.length > 0;
    const when = blocked ? new Date() : await nextSlot(targetId);

    await prisma.socialPost.create({
      data: {
        targetId,
        sourceKind: kind,
        sourceId: item.id,
        title: item.rendered.title.slice(0, 300),
        body: item.rendered.body,
        link: item.rendered.link,
        mediaUrl: item.rendered.mediaUrl,
        scheduledFor: when,
        status: blocked ? "BLOCKED" : "QUEUED",
        blockedReason: blocked ? violations.map((v) => `${v.rule}: ${v.detail}`).join(" · ") : null,
      },
    }).catch(() => {});

    if (blocked) {
      out.blocked++;
      out.details.push({ source: item.rendered.title.slice(0, 60), status: "BLOCKED", note: violations[0].rule });
    } else {
      out.queued++;
      out.details.push({
        source: item.rendered.title.slice(0, 60),
        status: "QUEUED",
        note: "ok",
        when: when.toISOString(),
      });
    }
    already.add(item.id);
  }

  return out;
}

/**
 * Send whatever is due. Called by the scheduled refresh.
 *
 * One post per destination per run, deliberately. The pacing rules already
 * spaced these out; draining several at once for the same place would undo
 * that the first time the cron missed a beat.
 */
export async function drainQueue(): Promise<{ sent: number; failed: number; skipped: number }> {
  const due = await prisma.socialPost.findMany({
    where: { status: "QUEUED", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: 25,
    include: { target: true },
  });

  let sent = 0, failed = 0, skipped = 0;
  const usedTargets = new Set<string>();

  for (const post of due) {
    if (usedTargets.has(post.targetId)) {
      skipped++;
      continue;
    }
    usedTargets.add(post.targetId);

    if (!post.target.active) {
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: "SKIPPED", result: "destination paused" },
      }).catch(() => {});
      skipped++;
      continue;
    }

    // Re-check at send time. Rules on the target may have been tightened
    // since this was queued, and the newer rule wins.
    const violations = checkCompliance(
      { title: post.title, body: post.body ?? undefined, link: post.link ?? undefined },
      post.target,
      post.flair
    );
    if (violations.length > 0) {
      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: "BLOCKED",
          blockedReason: violations.map((v) => `${v.rule}: ${v.detail}`).join(" · "),
        },
      }).catch(() => {});
      skipped++;
      continue;
    }

    const { sendOne } = await import("./dripSend");
    const res = await sendOne(post, post.target);

    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: res.ok ? "POSTED" : "FAILED",
        result: res.detail.slice(0, 500),
        postedAt: res.ok ? new Date() : null,
        attempts: { increment: 1 },
      },
    }).catch(() => {});

    if (res.ok) {
      sent++;
      await prisma.socialTarget
        .update({ where: { id: post.targetId }, data: { lastPostedAt: new Date() } })
        .catch(() => {});
    } else {
      failed++;
    }
  }

  return { sent, failed, skipped };
}

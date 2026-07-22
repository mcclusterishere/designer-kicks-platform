import { prisma } from "./db";
import { heatScore } from "./analytics";
import { pieceTaxonomy } from "./taxonomy";

/**
 * The Feed algorithm — one ranked, infinite-scrolling stream mixing
 * everything alive on the platform. Deterministic per request so
 * offset pagination never skips or repeats an item mid-scroll.
 *
 * Score = type base + recency + engagement + personal heat:
 *   - type base: admin posts lead, live battles beat static content
 *   - recency: half-life decay (72h) on the item's clock
 *   - engagement: log-scaled votes and Rate-game ratings
 *   - personal heat (signed in): pieces by artists you follow and
 *     pieces matching your passport's favorite brands rank up
 *   - pinned admin posts pin to the very top, always
 *
 * A diversity pass then breaks up runs — never three of the same type
 * in a row — so the scroll reads like a feed, not a list.
 */

export type FeedItem =
  | {
      type: "post";
      id: string;
      body: string;
      imageUrl: string | null;
      linkUrl: string | null;
      linkLabel: string | null;
      createdAt: string;
      // Byline: null = the house; set = the artist who posted it.
      artistName: string | null;
      artistSlug: string | null;
      reactions: number;
      mine: boolean;
      commentCount: number;
      // Author of the post when it's a claimed artist — lets the
      // client offer Block; null for house posts.
      authorUserId: string | null;
      comments: { id: string; name: string; body: string; userId: string }[];
    }
  | {
      type: "battle";
      id: string;
      title: string | null;
      endsAt: string;
      votes: number;
      a: { title: string; imageUrl: string; artistName: string };
      b: { title: string; imageUrl: string; artistName: string };
    }
  | {
      type: "piece";
      id: string;
      title: string;
      imageUrl: string;
      artistName: string;
      artistSlug: string | null;
      brand: string | null;
      category: string;
      votes: number;
      heat: { score: number; count: number } | null;
      // The viewer's own Rate-game score on this piece (null = hasn't
      // rated — the feed card shows the flames to vote right there).
      myStars: number | null;
    }
  | {
      type: "question";
      id: string;
      question: string;
      options: string[];
      articleSlug: string | null;
      articleTitle: string | null;
    }
  | {
      type: "poll";
      id: string;
      question: string;
      options: string[];
      category: string;
    }
  | {
      type: "drop";
      slug: string;
      name: string;
      excerpt: string;
      cover: string | null;
      dropAt: string | null;
    };

const HALF_LIFE_HOURS = 72;

function recency(date: Date, now: number): number {
  const ageHours = Math.max(0, (now - date.getTime()) / 3_600_000);
  return 40 * Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
}

/** "Air Jordan 9 OG 'Space Jam' — Release Date…" → the shoe name. */
function dropName(title: string): string {
  return title.split(/[—:|]/)[0].trim();
}

export async function getFeed(
  offset: number,
  limit: number,
  userId?: string | null
): Promise<{ items: FeedItem[]; nextOffset: number | null }> {
  const now = Date.now();
  const since = new Date(now - 90 * 24 * 3_600_000);

  const [posts, battles, pieces, questions, articles, follows, viewer, polls, blocks] = await Promise.all([
    prisma.feedPost.findMany({
      where: { OR: [{ pinned: true }, { createdAt: { gte: since } }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        artist: { select: { displayName: true, slug: true, userId: true } },
        _count: { select: { reactions: true, comments: true } },
        reactions: userId ? { where: { userId }, select: { id: true } } : false,
        comments: {
          orderBy: { createdAt: "desc" },
          take: 2,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.battle.findMany({
      where: { status: "ACTIVE" },
      include: {
        subA: { include: { artist: { select: { displayName: true } } } },
        subB: { include: { artist: { select: { displayName: true } } } },
        _count: { select: { votes: true } },
      },
      take: 25,
    }),
    prisma.submission.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      include: {
        artist: { select: { slug: true, displayName: true } },
        ratings: { select: { stars: true, userId: true } },
        _count: { select: { votes: true } },
      },
      take: 60,
    }),
    prisma.quizQuestion.findMany({
      where: {
        active: true,
        ...(userId ? { answers: { none: { userId } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { article: { select: { slug: true, title: true } } },
      take: 12,
    }),
    prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        OR: [{ dropAt: { gte: new Date(now - 24 * 3_600_000) } }, { publishedAt: { gte: since } }],
      },
      orderBy: { publishedAt: "desc" },
      take: 25,
    }),
    userId
      ? prisma.artistFollow.findMany({ where: { userId }, select: { artistId: true } })
      : Promise.resolve([]),
    userId
      ? prisma.user.findUnique({ where: { id: userId }, select: { favoriteBrands: true } })
      : Promise.resolve(null),
    prisma.poll.findMany({
      where: {
        active: true,
        // Fresh polls only — one a fan hasn't weighed in on yet.
        ...(userId ? { votes: { none: { userId } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    // Members this viewer has blocked — their posts and comments are
    // filtered out below (App Store UGC requirement).
    userId
      ? prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } })
      : Promise.resolve([]),
  ]);
  const blocked = new Set(blocks.map((b) => b.blockedId));

  const followed = new Set(follows.map((f) => f.artistId));
  const favBrands = new Set(
    (viewer?.favoriteBrands ?? "")
      .split(",")
      .map((b) => b.trim().toLowerCase())
      .filter(Boolean)
  );

  const scored: { score: number; item: FeedItem }[] = [];

  for (const p of posts) {
    // A blocked member's posts never reach the blocker's feed.
    if (p.artist?.userId && blocked.has(p.artist.userId)) continue;
    scored.push({
      score:
        (p.pinned ? 1000 : 60) +
        recency(p.createdAt, now) +
        5 * Math.log1p(p._count.reactions) +
        4 * Math.log1p(p._count.comments) +
        (p.artistId && followed.has(p.artistId) ? 12 : 0),
      item: {
        type: "post",
        id: p.id,
        body: p.body,
        imageUrl: p.imageUrl,
        linkUrl: p.linkUrl,
        linkLabel: p.linkLabel,
        createdAt: p.createdAt.toISOString(),
        artistName: p.artist?.displayName ?? null,
        artistSlug: p.artist?.slug ?? null,
        reactions: p._count.reactions,
        mine: Array.isArray(p.reactions) && p.reactions.length > 0,
        commentCount: p._count.comments,
        authorUserId: p.artist?.userId ?? null,
        comments: p.comments
          .slice()
          .reverse()
          .filter((c) => !blocked.has(c.user.id))
          .map((c) => ({ id: c.id, name: c.user.name ?? "A fan", body: c.body, userId: c.user.id })),
      },
    });
  }

  for (const b of battles) {
    scored.push({
      score: 50 + recency(b.createdAt, now) + 6 * Math.log1p(b._count.votes),
      item: {
        type: "battle",
        id: b.id,
        title: b.title,
        endsAt: b.endsAt.toISOString(),
        votes: b._count.votes,
        a: {
          title: b.subA.title,
          imageUrl: b.subA.imageUrl,
          artistName: b.subA.artist?.displayName ?? b.subA.artistName,
        },
        b: {
          title: b.subB.title,
          imageUrl: b.subB.imageUrl,
          artistName: b.subB.artist?.displayName ?? b.subB.artistName,
        },
      },
    });
  }

  for (const s of pieces) {
    const hs = heatScore(s.ratings.map((r) => r.stars));
    const brand = pieceTaxonomy(s).brand ?? null;
    const myStars = userId
      ? (s.ratings.find((r) => r.userId === userId)?.stars ?? null)
      : null;
    let personal = 0;
    if (s.artistId && followed.has(s.artistId)) personal += 12;
    if (brand && favBrands.has(brand.toLowerCase())) personal += 10;
    // Unrated pieces surface first for this viewer — the feed IS the
    // Rate game now, so it deals you what you haven't scored.
    if (userId && myStars === null) personal += 8;
    scored.push({
      score:
        30 +
        recency(s.createdAt, now) +
        6 * Math.log1p(s._count.votes) +
        4 * Math.log1p(hs?.count ?? 0) +
        personal,
      item: {
        type: "piece",
        id: s.id,
        title: s.title,
        imageUrl: s.imageUrl,
        artistName: s.artist?.displayName ?? s.artistName,
        artistSlug: s.artist?.slug ?? null,
        brand,
        category: s.category,
        votes: s._count.votes,
        heat: hs ? { score: hs.score, count: hs.count } : null,
        myStars,
      },
    });
  }

  for (const q of questions) {
    let options: string[] = [];
    try {
      options = JSON.parse(q.options);
    } catch {}
    if (options.length !== 4) continue;
    scored.push({
      score: 42 + 0.6 * recency(q.createdAt, now),
      item: {
        type: "question",
        id: q.id,
        question: q.question,
        options,
        articleSlug: q.article?.slug ?? null,
        articleTitle: q.article?.title ?? null,
      },
    });
  }

  for (const poll of polls) {
    let options: string[] = [];
    try {
      options = JSON.parse(poll.options);
    } catch {}
    if (options.length < 2) continue;
    scored.push({
      score: 44 + 0.6 * recency(poll.createdAt, now),
      item: {
        type: "poll",
        id: poll.id,
        question: poll.question,
        options,
        category: poll.category,
      },
    });
  }

  for (const a of articles) {
    const clock = a.dropAt ?? a.publishedAt ?? a.createdAt;
    const upcoming = a.dropAt && a.dropAt.getTime() > now ? 15 : 0;
    scored.push({
      score: 40 + upcoming + recency(clock, now),
      item: {
        type: "drop",
        slug: a.slug,
        name: dropName(a.title),
        excerpt: a.excerpt,
        cover: a.coverImage,
        dropAt: a.dropAt?.toISOString() ?? null,
      },
    });
  }

  scored.sort((x, y) => y.score - x.score);

  // Diversity pass: no three consecutive items of one type.
  const ordered: FeedItem[] = [];
  const pool = scored.map((s) => s.item);
  while (pool.length > 0) {
    const n = ordered.length;
    const lastTwoSame =
      n >= 2 && ordered[n - 1].type === ordered[n - 2].type ? ordered[n - 1].type : null;
    const idx = lastTwoSame ? pool.findIndex((i) => i.type !== lastTwoSame) : 0;
    ordered.push(...pool.splice(idx === -1 ? 0 : idx, 1));
  }

  const items = ordered.slice(offset, offset + limit);
  const nextOffset = offset + limit < ordered.length ? offset + limit : null;
  return { items, nextOffset };
}

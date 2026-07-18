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
      comments: { id: string; name: string; body: string }[];
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
      votes: number;
      heat: { score: number; count: number } | null;
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

  const [posts, battles, pieces, articles, follows, viewer] = await Promise.all([
    prisma.feedPost.findMany({
      where: { OR: [{ pinned: true }, { createdAt: { gte: since } }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        artist: { select: { displayName: true, slug: true } },
        _count: { select: { reactions: true, comments: true } },
        reactions: userId ? { where: { userId }, select: { id: true } } : false,
        comments: {
          orderBy: { createdAt: "desc" },
          take: 2,
          include: { user: { select: { name: true } } },
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
        ratings: { select: { stars: true } },
        _count: { select: { votes: true } },
      },
      take: 60,
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
  ]);

  const followed = new Set(follows.map((f) => f.artistId));
  const favBrands = new Set(
    (viewer?.favoriteBrands ?? "")
      .split(",")
      .map((b) => b.trim().toLowerCase())
      .filter(Boolean)
  );

  const scored: { score: number; item: FeedItem }[] = [];

  for (const p of posts) {
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
        comments: p.comments
          .slice()
          .reverse()
          .map((c) => ({ id: c.id, name: c.user.name ?? "A fan", body: c.body })),
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
    let personal = 0;
    if (s.artistId && followed.has(s.artistId)) personal += 12;
    if (brand && favBrands.has(brand.toLowerCase())) personal += 10;
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
        votes: s._count.votes,
        heat: hs ? { score: hs.score, count: hs.count } : null,
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

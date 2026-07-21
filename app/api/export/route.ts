import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

/**
 * Admin data-export hub — the whole database, one CSV at a time.
 *   /api/export?set=catalog   the shoe knowledge base (+ community flames)
 *   /api/export?set=artists   the roster with piece/follower counts
 *   /api/export?set=pieces    every submission with its ratings
 *   /api/export?set=battles   matchups, vote counts, winners
 *   /api/export?set=articles  the newsroom index
 *   /api/export?set=quiz      the Culture IQ question bank
 *   /api/export?set=flames    catalog rating aggregates
 *   /api/export?set=members   accounts + contact prefs (PII — internal only)
 *
 * Research-oriented sets (catalog/artists/pieces/battles/articles/quiz/
 * flames) carry no member PII, so they're safe to feed external tools.
 * The members set exists for owner ops (mailings, giveaways) — never
 * upload it to third-party AI tools.
 */

function cell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "yes" : "no") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const usd = (cents: number | null) => (cents ? Math.round(cents / 100) : null);
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

type Table = { header: string[]; rows: (string | number | boolean | null | undefined)[][] };

async function catalog(): Promise<Table> {
  const [shoes, flames] = await Promise.all([
    prisma.catalogShoe.findMany({
      orderBy: [{ brand: "asc" }, { releaseDate: { sort: "desc", nulls: "last" } }],
    }),
    prisma.catalogRating.groupBy({ by: ["shoeId"], _avg: { stars: true }, _count: true }),
  ]);
  const f = new Map(flames.map((x) => [x.shoeId, x]));
  return {
    header: ["sku", "name", "brand", "silhouette", "colorway", "lane", "retail_usd", "market_usd", "release_date", "avg_flames", "ratings", "image_url"],
    rows: shoes.map((s) => {
      const fl = f.get(s.id);
      return [s.sku, s.name, s.brand, s.silhouette, s.colorway, s.gender, usd(s.retailPriceCents), usd(s.marketPriceCents), day(s.releaseDate), fl ? Math.round((fl._avg.stars ?? 0) * 10) / 10 : null, fl?._count ?? 0, s.imageUrl];
    }),
  };
}

async function artists(): Promise<Table> {
  const rows = await prisma.artistProfile.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { submissions: true, followers: true } } },
  });
  return {
    header: ["slug", "display_name", "instagram", "city", "status", "claimed", "pieces", "followers", "created"],
    rows: rows.map((a) => [a.slug, a.displayName, a.instagram, a.city, a.status, Boolean(a.userId), a._count.submissions, a._count.followers, day(a.createdAt)]),
  };
}

async function pieces(): Promise<Table> {
  const [rows, ratings] = await Promise.all([
    prisma.submission.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.designRating.groupBy({ by: ["submissionId"], _avg: { stars: true }, _count: true }),
  ]);
  const r = new Map(ratings.map((x) => [x.submissionId, x]));
  return {
    header: ["title", "artist", "category", "base_shoe", "brand", "silhouette", "base_colorway", "status", "avg_flames", "ratings", "created", "image_url"],
    rows: rows.map((s) => {
      const rr = r.get(s.id);
      return [s.title, s.artistName, s.category, s.baseShoe, s.brand, s.silhouette, s.baseColorway, s.status, rr ? Math.round((rr._avg.stars ?? 0) * 10) / 10 : null, rr?._count ?? 0, day(s.createdAt), s.imageUrl];
    }),
  };
}

async function battles(): Promise<Table> {
  const rows = await prisma.battle.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subA: { select: { id: true, title: true, artistName: true } },
      subB: { select: { id: true, title: true, artistName: true } },
      winner: { select: { title: true } },
      votes: { select: { submissionId: true } },
    },
  });
  return {
    header: ["title", "status", "starts", "ends", "side_a", "artist_a", "votes_a", "side_b", "artist_b", "votes_b", "winner"],
    rows: rows.map((b) => [
      b.title, b.status, day(b.startsAt), day(b.endsAt),
      b.subA.title, b.subA.artistName, b.votes.filter((v) => v.submissionId === b.subA.id).length,
      b.subB.title, b.subB.artistName, b.votes.filter((v) => v.submissionId === b.subB.id).length,
      b.winner?.title ?? null,
    ]),
  };
}

async function articles(): Promise<Table> {
  const rows = await prisma.article.findMany({ orderBy: { createdAt: "desc" } });
  return {
    header: ["slug", "title", "status", "published", "drop_date", "sku", "tags", "raffle_url", "excerpt"],
    rows: rows.map((a) => [a.slug, a.title, a.status, day(a.publishedAt), day(a.dropAt), a.sku, a.tags, a.raffleUrl, a.excerpt]),
  };
}

async function quiz(): Promise<Table> {
  const rows = await prisma.quizQuestion.findMany({ orderBy: [{ category: "asc" }, { createdAt: "asc" }] });
  return {
    header: ["question", "options", "answer_index", "category", "difficulty", "active", "explanation"],
    rows: rows.map((q) => [q.question, q.options, q.answerIndex, q.category, q.difficulty, q.active, q.explanation]),
  };
}

async function flames(): Promise<Table> {
  const [agg, shoes] = await Promise.all([
    prisma.catalogRating.groupBy({ by: ["shoeId"], _avg: { stars: true }, _count: true, orderBy: { _count: { shoeId: "desc" } } }),
    prisma.catalogShoe.findMany({ select: { id: true, sku: true, name: true, brand: true } }),
  ]);
  const s = new Map(shoes.map((x) => [x.id, x]));
  return {
    header: ["sku", "name", "brand", "avg_flames", "ratings"],
    rows: agg.map((a) => {
      const shoe = s.get(a.shoeId);
      return [shoe?.sku, shoe?.name, shoe?.brand, Math.round((a._avg.stars ?? 0) * 10) / 10, a._count];
    }),
  };
}

async function members(): Promise<Table> {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      name: true, email: true, role: true, city: true, shopFor: true,
      marketingOptIn: true, battleAlerts: true, createdAt: true,
      _count: { select: { votes: true, quizRuns: true, giveawayEntries: true } },
    },
  });
  return {
    header: ["name", "email", "role", "city", "shop_for", "marketing_opt_in", "battle_alerts", "votes", "quiz_runs", "giveaway_entries", "joined"],
    rows: rows.map((u) => [u.name, u.email, u.role, u.city, u.shopFor, u.marketingOptIn, u.battleAlerts, u._count.votes, u._count.quizRuns, u._count.giveawayEntries, day(u.createdAt)]),
  };
}

const SETS: Record<string, () => Promise<Table>> = {
  catalog, artists, pieces, battles, articles, quiz, flames, members,
};

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin only." }, { status: 401 });
  }
  const set = (req.nextUrl.searchParams.get("set") ?? "").trim().toLowerCase();
  const build = SETS[set];
  if (!build) {
    return NextResponse.json(
      { error: `Unknown set. Pick one of: ${Object.keys(SETS).join(", ")}` },
      { status: 400 }
    );
  }
  const { header, rows } = await build();
  const csv = [header.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="heat-chart-${set}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

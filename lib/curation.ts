import { prisma } from "./db";
import { isCollabName, collabReason } from "./collab";
import { RARE_TIERS, rarityFor } from "./rarity";

/**
 * "Only collabs and rare shit from now on."
 *
 * The editorial line, applied to a catalogue that was imported before
 * there was one. This decides what stays on the site and what goes
 * dark, and it is deliberately built as a PREVIEW first — the whole
 * point is that the owner sees the real counts before anything moves,
 * because the two obvious ways to do this are both wrong:
 *
 *  - Deleting rows destroys other people's data. CatalogRating,
 *    PriceSnapshot and Prediction all cascade off CatalogShoe, so a
 *    purge takes the culture's flame ratings, every price chart, and
 *    members' predictions with it, and leaves custom-vs-OG battles
 *    pointing at a null OG. Hiding reaches the same visible outcome
 *    and can be undone in one click.
 *
 *  - Hiding everything that is not CONFIRMED rare would empty the
 *    site. Rarity is market price over retail, and a pair with no
 *    market price yet reads "unknown" — not "common". The price syncs
 *    that fill that column have never run in production, so on today's
 *    data "unknown" is the majority, and it contains unreleased
 *    collabs and genuine grails alongside the filler.
 *
 * So the rule is: keep anything that is a collab OR is confirmed rare,
 * and hide only what we can POSITIVELY show is a commoner — a pair with
 * a real live price that sits at or under its sticker. Unpriced rows
 * are left alone and reported separately, because "we have not looked
 * yet" is not a verdict.
 */

export type Verdict = "collab" | "rare" | "common" | "unknown";

export type ShoeLite = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  hidden: boolean;
  retailPriceCents: number | null;
  marketPriceCents: number | null;
  ebayNewCents: number | null;
  ebayUsedCents: number | null;
};

export function verdictFor(shoe: ShoeLite): { verdict: Verdict; why: string } {
  if (isCollabName(shoe.name)) {
    return { verdict: "collab", why: collabReason(shoe.name) ?? "collaboration" };
  }
  const read = rarityFor(shoe);
  if (RARE_TIERS.includes(read.tier)) {
    return {
      verdict: "rare",
      why: `${read.label} — trades at ${(read.multiple ?? 0).toFixed(1)}× retail`,
    };
  }
  if (read.tier === "unknown") {
    return { verdict: "unknown", why: "no live price yet — not judged" };
  }
  return { verdict: "common", why: `${read.label} at ${(read.multiple ?? 0).toFixed(2)}× retail` };
}

export type CurationPreview = {
  total: number;
  collab: number;
  rare: number;
  common: number;
  unknown: number;
  alreadyHidden: number;
  /** What "apply" would actually change right now. */
  wouldHide: number;
  /** A readable sample of the chopping block, so the number has faces. */
  sampleCommon: { sku: string; name: string; why: string }[];
  /** Collabs that would be KEPT despite having no price — the reason
   *  the collab test exists at all. */
  sampleUnpricedCollab: { sku: string; name: string; why: string }[];
  /** Ratings, snapshots and predictions that a HARD delete would take. */
  collateral: { ratings: number; priceSnapshots: number; predictions: number; battles: number };
};

const LITE = {
  id: true, sku: true, name: true, brand: true, hidden: true,
  retailPriceCents: true, marketPriceCents: true,
  ebayNewCents: true, ebayUsedCents: true,
} as const;

/**
 * Read the whole catalogue and say what would happen. Changes nothing.
 */
export async function previewCuration(): Promise<CurationPreview> {
  const shoes = await prisma.catalogShoe.findMany({ select: LITE });

  const buckets: Record<Verdict, ShoeLite[]> = { collab: [], rare: [], common: [], unknown: [] };
  const whyBySku = new Map<string, string>();
  for (const s of shoes) {
    const { verdict, why } = verdictFor(s);
    buckets[verdict].push(s);
    whyBySku.set(s.sku, why);
  }

  const commonIds = buckets.common.map((s) => s.id);
  const [ratings, priceSnapshots, predictions, battles] = await Promise.all([
    commonIds.length ? prisma.catalogRating.count({ where: { shoeId: { in: commonIds } } }) : 0,
    commonIds.length ? prisma.priceSnapshot.count({ where: { shoeId: { in: commonIds } } }) : 0,
    commonIds.length ? prisma.prediction.count({ where: { shoeId: { in: commonIds } } }) : 0,
    commonIds.length ? prisma.battle.count({ where: { ogShoeId: { in: commonIds } } }) : 0,
  ]);

  return {
    total: shoes.length,
    collab: buckets.collab.length,
    rare: buckets.rare.length,
    common: buckets.common.length,
    unknown: buckets.unknown.length,
    alreadyHidden: shoes.filter((s) => s.hidden).length,
    wouldHide: buckets.common.filter((s) => !s.hidden).length,
    sampleCommon: buckets.common.slice(0, 12).map((s) => ({
      sku: s.sku, name: s.name, why: whyBySku.get(s.sku) ?? "",
    })),
    sampleUnpricedCollab: buckets.collab
      .filter((s) => rarityFor(s).tier === "unknown")
      .slice(0, 8)
      .map((s) => ({ sku: s.sku, name: s.name, why: whyBySku.get(s.sku) ?? "" })),
    collateral: { ratings, priceSnapshots, predictions, battles },
  };
}

export type CurationResult = { ok: boolean; hidden: number; error?: string };

/**
 * Take the commoners off the site.
 *
 * Only pairs we can positively show are common — a real live price at or
 * under sticker. Unpriced rows are never touched, whatever they look
 * like, because the site's own price syncs are what would settle them
 * and a missing number is not evidence.
 */
export async function hideCommoners(): Promise<CurationResult> {
  const shoes = await prisma.catalogShoe.findMany({ where: { hidden: false }, select: LITE });
  const doomed = shoes.filter((s) => verdictFor(s).verdict === "common");
  if (doomed.length === 0) return { ok: true, hidden: 0 };

  const now = new Date();
  let n = 0;
  // Chunked so a catalogue in the tens of thousands does not build one
  // enormous IN list.
  for (let i = 0; i < doomed.length; i += 500) {
    const chunk = doomed.slice(i, i + 500);
    const res = await prisma.catalogShoe.updateMany({
      where: { id: { in: chunk.map((s) => s.id) } },
      data: { hidden: true, hiddenAt: now, hiddenReason: "commoner — collabs and rare only" },
    });
    n += res.count;
  }
  return { ok: true, hidden: n };
}

/** Undo. The reason this is safe to try. */
export async function unhideAll(): Promise<CurationResult> {
  const res = await prisma.catalogShoe.updateMany({
    where: { hidden: true },
    data: { hidden: false, hiddenAt: null, hiddenReason: null },
  });
  return { ok: true, hidden: res.count };
}

/**
 * The one clause every public surface uses, so "hidden" cannot mean
 * different things on the grid, the detail page and the sitemap.
 */
export const VISIBLE = { hidden: false } as const;

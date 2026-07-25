import { prisma } from "./db";
import { searchPlaces, zipFromAddress, type ScoutedPlace } from "./stores";

/**
 * Gallery Run — automated outreach to the rooms that decide what counts as art.
 *
 * The thesis the whole customs side rests on is that a one-of-one pair is a
 * work, not a product. Galleries are where that stops being a claim. A show
 * is provenance, a press mention is a comp, and a gallery relationship is
 * the difference between "sneaker guy" and "represented artist" — which is
 * also what makes sale data mean anything to a lender later.
 *
 * The mechanics are the Store Scout's, because finding a gallery and
 * finding a sneaker shop are the same problem: search, qualify, pitch,
 * circle back. What differs is the letter, and it differs completely.
 *
 * WHAT A GALLERY ACTUALLY RESPONDS TO. Not that we have a website, not
 * that sneakers are cool. An artist with a market: a body of work, a
 * record of what it sold for, and an audience that showed up. We hold all
 * three as real rows, so the pitch quotes them instead of adjectives —
 * and when we don't hold them for a given artist, the pitch says less
 * rather than inventing more. A gallery can smell a padded number from
 * across the room, and you get exactly one first email.
 */

export const GALLERY_STATUSES = ["SCOUTED", "QUALIFIED", "INVITED", "JOINED", "PASSED"] as const;

/**
 * The searches that actually surface the right rooms. Streetwear and
 * contemporary galleries show this work; blue-chip and antique dealers
 * never will, so we don't waste a send on them.
 */
export const GALLERY_QUERIES = [
  (where: string) => `contemporary art gallery in ${where}`,
  (where: string) => `street art gallery in ${where}`,
  (where: string) => `art gallery accepting submissions in ${where}`,
  (where: string) => `pop up gallery space in ${where}`,
  (where: string) => `artist collective gallery in ${where}`,
];

export type GalleryScanResult = {
  query: string;
  found: number;
  saved: number;
  skipped: number;
};

/**
 * Sweep a city or zip for galleries and stage the new ones.
 *
 * placeId dedupes across rescans and across queries, so running every
 * angle on the same city is safe and the overlap costs nothing.
 */
export async function scanGalleries(where: string): Promise<GalleryScanResult[]> {
  const out: GalleryScanResult[] = [];
  for (const build of GALLERY_QUERIES) {
    const query = build(where);
    let places: ScoutedPlace[] = [];
    try {
      places = await searchPlaces(query);
    } catch (e) {
      out.push({ query, found: 0, saved: 0, skipped: 0 });
      // One failed angle shouldn't abandon the sweep.
      if (e instanceof Error && /GOOGLE_PLACES_API_KEY/.test(e.message)) throw e;
      continue;
    }
    let saved = 0;
    let skipped = 0;
    for (const p of places) {
      const existing = p.placeId
        ? await prisma.storeLead.findUnique({ where: { placeId: p.placeId } })
        : null;
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.storeLead.create({
        data: {
          kind: "GALLERY",
          placeId: p.placeId,
          name: p.name,
          address: p.address,
          zip: zipFromAddress(p.address),
          phone: p.phone,
          mapsUrl: p.mapsUrl,
          website: p.website,
          rating: p.rating,
          reviewCount: p.reviewCount,
          status: "SCOUTED",
        },
      });
      saved++;
    }
    out.push({ query, found: places.length, saved, skipped });
  }
  return out;
}

/**
 * The evidence a gallery would actually weigh, pulled from real rows.
 *
 * Deliberately narrow. Confirmed sales only — a pending sale is a claim,
 * and quoting claims to a gallery is how you get one meeting and no
 * second one.
 */
export type ArtistEvidence = {
  artistId: string;
  displayName: string;
  slug: string;
  city: string | null;
  pieces: number;
  confirmedSales: number;
  medianSaleCents: number | null;
  topSaleCents: number | null;
  resales: number;
};

export async function galleryEvidence(limit = 3): Promise<ArtistEvidence[]> {
  const artists = await prisma.artistProfile.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true, displayName: true, slug: true, city: true,
      submissions: {
        where: { status: "APPROVED" },
        select: {
          id: true,
          sales: { where: { status: "CONFIRMED" }, select: { priceCents: true } },
        },
      },
    },
  });

  const rows: ArtistEvidence[] = artists.map((a) => {
    const prices = a.submissions.flatMap((s) => s.sales.map((x) => x.priceCents)).sort((x, y) => x - y);
    // A piece that sold more than once is the whole argument: it means a
    // secondary market exists for this maker, not just a first buyer.
    const resales = a.submissions.filter((s) => s.sales.length > 1).length;
    return {
      artistId: a.id,
      displayName: a.displayName,
      slug: a.slug,
      city: a.city,
      pieces: a.submissions.length,
      confirmedSales: prices.length,
      // Median, not mean — one outlier sale shouldn't set the impression.
      medianSaleCents: prices.length ? prices[Math.floor(prices.length / 2)] : null,
      topSaleCents: prices.length ? prices[prices.length - 1] : null,
      resales,
    };
  });

  // Lead with makers who have an actual record. Sales first, then depth of
  // catalogue — a gallery reads the market before it reads the volume.
  return rows
    .sort((a, b) => b.confirmedSales - a.confirmedSales || b.pieces - a.pieces)
    .slice(0, limit);
}

const usd = (c: number) => `$${Math.round(c / 100).toLocaleString("en-US")}`;

/**
 * The letter.
 *
 * Short on purpose. Galleries read the first two lines and the ask; the
 * evidence is there for the ones who keep reading, and there's no
 * attachment, no deck, and no adjective doing work a number could do.
 */
export function galleryPitch(
  lead: { name: string; kind: string },
  evidence: ArtistEvidence[],
  opts: { siteUrl?: string; senderName?: string } = {}
): { subject: string; body: string } {
  const site = opts.siteUrl ?? "https://theheatchart.com";
  const from = opts.senderName ?? "Matt";
  const lead1 = evidence[0];

  const proof = evidence
    .filter((e) => e.confirmedSales > 0)
    .map((e) => {
      const bits = [`${e.pieces} works`];
      if (e.medianSaleCents) bits.push(`median sale ${usd(e.medianSaleCents)}`);
      if (e.topSaleCents && e.topSaleCents !== e.medianSaleCents) bits.push(`high ${usd(e.topSaleCents)}`);
      if (e.resales) bits.push(`${e.resales} resold on the secondary`);
      return `• ${e.displayName} — ${bits.join(", ")} (${site}/artists/${e.slug})`;
    });

  // The subject may only claim what the body can back. An early version
  // promised "with a sale record" over a body that admitted there wasn't
  // one yet — the exact bait-and-switch that gets a first email deleted
  // and a second one filtered.
  const subject = proof.length
    ? `Wearable one-of-ones with a sale record — ${lead1!.displayName}`
    : `One-of-one hand-painted works — would you take a look?`;

  // When there is no confirmed sale history yet, the letter says so and
  // asks for a look rather than dressing up an empty record.
  const evidenceBlock = proof.length
    ? `A few of the makers and what their work has actually done:\n\n${proof.join("\n")}\n\n` +
      `Those are confirmed sales with the buyer on record, not asking prices.`
    : `We're early on documented resales, so I won't pretend to a market that isn't there yet. ` +
      `What we do have is the catalogue, the provenance chain, and the audience.`;

  const body = [
    `Hi ${lead.name} team,`,
    ``,
    `I run The Heat Chart, a platform for one-of-one hand-painted footwear. Each piece is a ` +
      `single work by a named artist, photographed, catalogued, and tracked through every ` +
      `resale — so a buyer gets provenance the way they would with a print, not a receipt ` +
      `from a reseller.`,
    ``,
    evidenceBlock,
    ``,
    `The ask is small: would you look at the work with a view to a group show, a case, or ` +
      `consignment? I'll send images sized however you want them, and I can put you in front ` +
      `of the artist directly — I'm not trying to be the middleman on the relationship.`,
    ``,
    `The catalogue is at ${site}. Happy to be told it isn't for you.`,
    ``,
    `— ${from}`,
  ].join("\n");

  return { subject, body };
}

const DAY = 24 * 60 * 60 * 1000;

/** How long a stage may sit untouched before it comes back around. */
const CADENCE: Record<string, number> = {
  SCOUTED: 0, // never contacted — due now
  QUALIFIED: 1, // researched and worth a send — do it tomorrow at the latest
  INVITED: 10, // galleries are slow; a 3-day nudge reads as pestering
};

const COLD_DAYS = 45;

export type GalleryRunItem = {
  id: string;
  name: string;
  status: string;
  website: string | null;
  email: string | null;
  address: string | null;
  daysSinceTouch: number | null;
  touchCount: number;
  reason: string;
  action: string;
  priority: number;
  cold: boolean;
};

/**
 * Who to contact today. Same discipline as the Roster Run: the queue is
 * computed, not remembered, and the reason each row is here is stated so
 * whoever works it isn't guessing.
 */
export async function galleryRun(limit = 25): Promise<GalleryRunItem[]> {
  const leads = await prisma.storeLead.findMany({
    where: { kind: "GALLERY", status: { notIn: ["JOINED", "PASSED"] } },
    orderBy: { createdAt: "asc" },
    take: 300,
  });
  const now = Date.now();

  const items: GalleryRunItem[] = [];
  for (const l of leads) {
    const days = l.lastTouchAt ? Math.floor((now - l.lastTouchAt.getTime()) / DAY) : null;
    const due = CADENCE[l.status] ?? 14;
    if (days !== null && days < due) continue;

    const cold = days !== null && days >= COLD_DAYS;
    let reason: string;
    let action: string;
    let priority: number;

    if (l.status === "SCOUTED") {
      reason = "Found, never contacted.";
      action = l.email
        ? "Send the pitch."
        : "Find a contact on their site, then send the pitch.";
      // A gallery with a contact already on file is a send we can make now,
      // so it outranks one that still needs research.
      priority = l.email ? 90 : 60;
    } else if (l.status === "QUALIFIED") {
      reason = "Researched and worth a send.";
      action = "Send the pitch today.";
      priority = 95;
    } else {
      reason = days === null ? "Marked invited, no send recorded." : `Pitched ${days} days ago, no reply.`;
      action = cold ? "One last note, then archive it." : "Nudge — one short line, no re-pitch.";
      priority = cold ? 40 : 70;
    }
    if (cold) priority -= 20;

    items.push({
      id: l.id,
      name: l.name,
      status: l.status,
      website: l.website,
      email: l.email,
      address: l.address,
      daysSinceTouch: days,
      touchCount: l.touchCount,
      reason,
      action,
      priority,
      cold,
    });
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

/** Record that a gallery was actually contacted, so the clock restarts. */
export async function markGalleryTouched(id: string, status?: string) {
  return prisma.storeLead.update({
    where: { id },
    data: {
      lastTouchAt: new Date(),
      touchCount: { increment: 1 },
      ...(status ? { status } : {}),
      ...(status === "INVITED" ? { invitedAt: new Date() } : {}),
    },
  });
}

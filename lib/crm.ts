import { prisma } from "./db";

/**
 * The CRM proper.
 *
 * Everything above the line here is what any modern CRM does — timeline,
 * tasks, segments, search. Everything below it is what only this one can
 * do, because a general CRM doesn't know what a shoe is.
 *
 * The domain-native part is the actual argument for switching. HubSpot
 * can hold a customer's name; it cannot tell a maker that four people on
 * their list wear a 10.5 and none of them own a 10.5, or that the piece
 * a collector bought two years ago is now worth 40% more and that's a
 * reason to call. Those facts already exist in this database. Nobody has
 * ever put them in front of the person who could act on them.
 */

const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------- //
//  Standard CRM
// ---------------------------------------------------------------- //

export const ACTIVITY_KINDS = [
  "NOTE", "CALL", "EMAIL", "DM", "MEETING", "SALE", "OFFER", "CLAIM", "IMPORT",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** Log something that happened. Bumps the contact's recency in one write. */
export async function logActivity(input: {
  contactId: string;
  kind: ActivityKind;
  body: string;
  occurredAt?: Date;
  sourceKey?: string;
  submissionId?: string;
}): Promise<{ ok: boolean; deduped?: boolean }> {
  const occurredAt = input.occurredAt ?? new Date();
  try {
    await prisma.$transaction([
      prisma.contactActivity.create({
        data: {
          contactId: input.contactId,
          kind: input.kind,
          body: input.body.slice(0, 2000),
          occurredAt,
          sourceKey: input.sourceKey ?? null,
          submissionId: input.submissionId ?? null,
        },
      }),
      // lastContactAt is a human touch; lastActivityAt is any event at
      // all. A sale landing shouldn't make it look like you called them.
      prisma.contact.update({
        where: { id: input.contactId },
        data: {
          lastActivityAt: occurredAt,
          ...(["CALL", "EMAIL", "DM", "MEETING", "NOTE"].includes(input.kind)
            ? { lastContactAt: occurredAt }
            : {}),
        },
      }),
    ]);
    return { ok: true };
  } catch (e) {
    // A unique violation on sourceKey means the platform already logged
    // this exact event. That's the dedupe working, not a failure.
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { ok: true, deduped: true };
    }
    throw e;
  }
}

/** The contact's whole story, newest first. */
export async function timeline(contactId: string, limit = 100) {
  return prisma.contactActivity.findMany({
    where: { contactId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

/**
 * Fold what the platform already knows into the timeline.
 *
 * Sales, claims and offers are recorded elsewhere in the system. Making
 * a maker re-type them is exactly why CRMs go stale, so they're mirrored
 * in — idempotently, via sourceKey, so running this repeatedly is safe.
 */
export async function syncTimelineFromPlatform(artistId: string): Promise<{ added: number }> {
  const contacts = await prisma.contact.findMany({
    where: { artistId, email: { not: null } },
    select: { id: true, email: true },
  });
  if (contacts.length === 0) return { added: 0 };

  const byEmail = new Map(contacts.map((c) => [c.email!.toLowerCase(), c.id]));

  const sales = await prisma.sale.findMany({
    where: { submission: { artistId }, buyerEmail: { in: [...byEmail.keys()] } },
    select: {
      id: true, buyerEmail: true, priceCents: true, soldAt: true, status: true,
      submission: { select: { id: true, title: true } },
    },
  });

  let added = 0;
  for (const s of sales) {
    const contactId = byEmail.get(s.buyerEmail.toLowerCase());
    if (!contactId) continue;
    const price = (s.priceCents / 100).toLocaleString("en-US", {
      style: "currency", currency: "USD", maximumFractionDigits: 0,
    });
    const r = await logActivity({
      contactId,
      kind: s.status === "CONFIRMED" ? "CLAIM" : "SALE",
      body:
        s.status === "CONFIRMED"
          ? `Claimed "${s.submission.title}" — ${price}. It's officially theirs.`
          : `Bought "${s.submission.title}" for ${price}. Not claimed yet.`,
      occurredAt: s.soldAt,
      sourceKey: `sale:${s.id}`,
      submissionId: s.submission.id,
    });
    if (!r.deduped) added++;
  }
  return { added };
}

export async function openTasks(artistId: string) {
  const rows = await prisma.contactTask.findMany({
    where: { doneAt: null, contact: { artistId } },
    orderBy: { dueAt: "asc" },
    take: 100,
    include: { contact: { select: { id: true, name: true } } },
  });
  const now = Date.now();
  return rows.map((t) => ({
    ...t,
    overdue: t.dueAt.getTime() < now,
    daysUntil: Math.round((t.dueAt.getTime() - now) / DAY),
  }));
}

export type SegmentKey =
  | "all" | "customers" | "repeat" | "leads" | "quiet" | "vip" | "unclaimed";

export const SEGMENTS: { key: SegmentKey; label: string; blurb: string }[] = [
  { key: "all", label: "Everyone", blurb: "The whole book" },
  { key: "customers", label: "Bought before", blurb: "At least one purchase" },
  { key: "repeat", label: "Came back", blurb: "More than one purchase" },
  { key: "vip", label: "Top spenders", blurb: "Your best customers by lifetime spend" },
  { key: "leads", label: "Never bought", blurb: "Interested, no purchase yet" },
  { key: "quiet", label: "Gone quiet", blurb: "Bought once, silent 120+ days" },
  { key: "unclaimed", label: "Owes you a claim", blurb: "Bought but never claimed the piece" },
];

/** Search + segment, the way a CRM list view actually works. */
export async function contactList(
  artistId: string,
  opts: { segment?: SegmentKey; q?: string; limit?: number } = {}
) {
  const { segment = "all", q = "", limit = 300 } = opts;
  const quietBefore = new Date(Date.now() - 120 * DAY);

  const segmentWhere: Record<SegmentKey, object> = {
    all: {},
    customers: { purchaseCount: { gt: 0 } },
    repeat: { purchaseCount: { gt: 1 } },
    vip: { totalSpentCents: { gt: 0 } },
    leads: { purchaseCount: 0 },
    quiet: { purchaseCount: { gt: 0 }, lastContactAt: { lt: quietBefore } },
    unclaimed: {},
  };

  const search = q.trim()
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { social: { contains: q, mode: "insensitive" as const } },
          { city: { contains: q, mode: "insensitive" as const } },
          { notes: { contains: q, mode: "insensitive" as const } },
          { tags: { has: q } },
        ],
      }
    : {};

  const rows = await prisma.contact.findMany({
    where: { artistId, ...segmentWhere[segment], ...search },
    orderBy:
      segment === "vip"
        ? [{ totalSpentCents: "desc" }]
        : segment === "quiet"
          ? [{ lastContactAt: "asc" }]
          : [{ totalSpentCents: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { _count: { select: { activities: true, tasks: true } } },
  });

  const now = Date.now();
  return rows.map((c) => ({
    ...c,
    daysQuiet: c.lastContactAt ? Math.round((now - c.lastContactAt.getTime()) / DAY) : null,
  }));
}

// ---------------------------------------------------------------- //
//  The part no other CRM can do
// ---------------------------------------------------------------- //

/**
 * Who fits a piece you're holding.
 *
 * Obvious in footwear, absent from every CRM on the market, because a
 * general CRM has no concept of a size. A maker finishing a 10.5 should
 * be able to see, in one click, the four people on their list who wear
 * one — rather than posting it publicly and hoping.
 */
export async function sizeMatches(artistId: string, size: string) {
  const norm = size.trim().replace(/^(us|size)\s*/i, "");
  if (!norm) return [];

  const contacts = await prisma.contact.findMany({
    where: { artistId },
    select: {
      id: true, name: true, email: true, shoeSize: true, userId: true,
      purchaseCount: true, totalSpentCents: true,
    },
  });

  // Buyers who never made an account keep their size on the contact;
  // members have it on their profile. Check both, prefer the contact.
  const memberIds = contacts.map((c) => c.userId).filter((x): x is string => !!x);
  const members = memberIds.length
    ? await prisma.user.findMany({
        where: { id: { in: memberIds }, shoeSize: { not: null } },
        select: { id: true, shoeSize: true },
      })
    : [];
  const memberSize = new Map(members.map((m) => [m.id, m.shoeSize!]));

  return contacts
    .map((c) => ({ ...c, size: c.shoeSize ?? (c.userId ? memberSize.get(c.userId) : null) ?? null }))
    .filter((c) => c.size !== null && c.size.trim().replace(/^(us|size)\s*/i, "") === norm)
    .sort((a, b) => b.totalSpentCents - a.totalSpentCents);
}

/**
 * What a contact is actually into, from what they vote and rate — not
 * from what they bought.
 *
 * This is the inversion that matters. Purchase history tells you what
 * somebody already owns; taste tells you what they'd buy next. The
 * platform has been collecting the second signal all along as a game
 * mechanic, and it has never once been shown to the person who could
 * sell against it.
 *
 * Only available for contacts who have an account, which is one more
 * reason getting a buyer to claim their piece is worth chasing.
 */
export async function contactTaste(contactUserId: string | null) {
  if (!contactUserId) return null;
  const { getTasteProfile } = await import("./taste");
  const profile = await getTasteProfile(contactUserId).catch(() => null);
  if (!profile || profile.signalCount === 0) return null;
  return {
    signalCount: profile.signalCount,
    archetype: profile.archetype,
    brands: profile.brands.slice(0, 3),
    silhouettes: profile.silhouettes.slice(0, 3),
    colorways: profile.colorways.slice(0, 3),
  };
}

/**
 * What this collector is holding from you, and what it's worth now.
 *
 * A customer sitting on a piece that has appreciated is the best
 * testimonial a maker has and their most likely repeat buyer, and until
 * now nothing anywhere told them which customer that was.
 */
export async function contactPortfolio(contactUserId: string | null, artistId: string) {
  if (!contactUserId) return { pieces: [], paidCents: 0, valueCents: 0, changePct: 0 };

  const pieces = await prisma.submission.findMany({
    where: { ownerId: contactUserId, artistId },
    select: {
      id: true, title: true, imageUrl: true, askingPriceCents: true,
      sales: {
        where: { status: "CONFIRMED" },
        orderBy: { soldAt: "desc" },
        take: 1,
        select: { priceCents: true, soldAt: true },
      },
      offers: {
        where: { status: "OPEN" },
        orderBy: { amountCents: "desc" },
        take: 1,
        select: { amountCents: true },
      },
    },
  });

  let paidCents = 0;
  let valueCents = 0;
  const out = pieces.map((p) => {
    const paid = p.sales[0]?.priceCents ?? 0;
    // Value is the best real signal available, in order: a live offer
    // somebody has actually made, then the owner's own ask, then what
    // they paid. Never an invented appraisal.
    const value = p.offers[0]?.amountCents ?? p.askingPriceCents ?? paid;
    paidCents += paid;
    valueCents += value;
    return {
      id: p.id,
      title: p.title,
      imageUrl: p.imageUrl,
      paidCents: paid,
      valueCents: value,
      topOfferCents: p.offers[0]?.amountCents ?? null,
      boughtAt: p.sales[0]?.soldAt ?? null,
    };
  });

  return {
    pieces: out,
    paidCents,
    valueCents,
    changePct: paidCents > 0 ? Math.round(((valueCents - paidCents) / paidCents) * 1000) / 10 : 0,
  };
}

/**
 * Who to talk to today, and why — ranked by reason rather than by date.
 *
 * A calendar reminder says "it's been 90 days". This says "someone just
 * bid on the piece they own", which is a reason a human would actually
 * act on. Every entry has to cite a fact from the database; nothing here
 * is a generic nudge.
 */
export type Signal = { contactId: string; name: string; reason: string; weight: number };

export async function todaysSignals(artistId: string, limit = 12): Promise<Signal[]> {
  const contacts = await prisma.contact.findMany({
    where: { artistId },
    select: {
      id: true, name: true, userId: true, email: true, purchaseCount: true,
      totalSpentCents: true, lastContactAt: true,
    },
  });
  if (contacts.length === 0) return [];

  const signals: Signal[] = [];
  const now = Date.now();
  const ownerIds = contacts.map((c) => c.userId).filter((x): x is string => !!x);

  // A live offer on a piece they own — the strongest reason there is.
  if (ownerIds.length > 0) {
    const offers = await prisma.offer.findMany({
      where: { status: "OPEN", submission: { ownerId: { in: ownerIds }, artistId } },
      select: {
        amountCents: true,
        submission: { select: { title: true, ownerId: true } },
      },
    });
    for (const o of offers) {
      const c = contacts.find((x) => x.userId === o.submission.ownerId);
      if (!c) continue;
      const amt = (o.amountCents / 100).toLocaleString("en-US", {
        style: "currency", currency: "USD", maximumFractionDigits: 0,
      });
      signals.push({
        contactId: c.id,
        name: c.name,
        reason: `Someone bid ${amt} on their "${o.submission.title}" — they may not have seen it`,
        weight: 100,
      });
    }
  }

  // Bought once and went quiet. The second sale is the cheapest one.
  for (const c of contacts) {
    if (c.purchaseCount !== 1 || !c.lastContactAt) continue;
    const days = Math.round((now - c.lastContactAt.getTime()) / DAY);
    if (days < 120) continue;
    signals.push({
      contactId: c.id,
      name: c.name,
      reason: `Bought once, ${days} days ago, nothing since — one message is the cheapest sale you'll make`,
      weight: 60 + Math.min(20, Math.floor(days / 60)),
    });
  }

  // A repeat buyer overdue a check-in outranks a stranger every time.
  for (const c of contacts) {
    if (c.purchaseCount < 2 || !c.lastContactAt) continue;
    const days = Math.round((now - c.lastContactAt.getTime()) / DAY);
    if (days < 90) continue;
    const spend = (c.totalSpentCents / 100).toLocaleString("en-US", {
      style: "currency", currency: "USD", maximumFractionDigits: 0,
    });
    signals.push({
      contactId: c.id,
      name: c.name,
      reason: `Repeat buyer — ${spend} across ${c.purchaseCount} pieces, quiet for ${days} days`,
      weight: 80,
    });
  }

  // Overdue tasks the maker set themselves.
  const overdue = await prisma.contactTask.findMany({
    where: { doneAt: null, dueAt: { lt: new Date() }, contact: { artistId } },
    select: { title: true, dueAt: true, contact: { select: { id: true, name: true } } },
    take: 20,
  });
  for (const t of overdue) {
    signals.push({
      contactId: t.contact.id,
      name: t.contact.name,
      reason: `You set a reminder: ${t.title}`,
      weight: 90,
    });
  }

  // One row per person — the most urgent reason wins, so nobody appears
  // three times and drowns out everyone else.
  const best = new Map<string, Signal>();
  for (const s of signals) {
    const cur = best.get(s.contactId);
    if (!cur || s.weight > cur.weight) best.set(s.contactId, s);
  }
  return [...best.values()].sort((a, b) => b.weight - a.weight).slice(0, limit);
}

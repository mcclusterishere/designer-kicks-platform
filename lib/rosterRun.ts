import { prisma } from "./db";

/**
 * The Roster Run — the daily "who do I talk to today" queue.
 *
 * Recruiting pipelines don't die from bad leads; they die because nobody
 * circles back. This computes exactly who is due right now from the
 * pipeline stage plus how long it's been since the last touch, sorts the
 * most urgent to the top, and hands over a ready-to-send message for
 * each. Nothing to remember, nothing to track by hand.
 */

const DAY = 24 * 60 * 60 * 1000;

// How long a stage may sit untouched before it's due again.
const CADENCE: Record<string, number> = {
  NEW: 0, // never contacted — due immediately
  CONTACTED: 3, // said hi, no reply → nudge at 3 days
  IN_TALKS: 5, // they replied → keep it warm
  INVITED: 7, // claim link sent, page unclaimed → remind
};

const COLD_DAYS = 21; // untouched this long = last shot or archive

export type RunItem = {
  artistId: string;
  name: string;
  slug: string;
  instagram: string | null;
  email: string;
  stage: string;
  daysSinceTouch: number | null;
  touchCount: number;
  pieceCount: number;
  /** Why this row is in today's queue. */
  reason: string;
  /** What to actually do. */
  action: string;
  /** Urgency — higher sorts first. */
  priority: number;
  /** Ready-to-send message, personalized from real data. */
  message: string;
  cold: boolean;
};

function daysSince(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / DAY);
}

/**
 * The pitch, written from what we actually know about them. Deterministic
 * on purpose — no API call to fail, and it never invents credentials.
 */
function draftMessage(a: {
  displayName: string;
  slug: string;
  stage: string;
  pieceCount: number;
  touchCount: number;
}): string {
  const url = `theheatchart.com/artists/${a.slug}`;
  const work =
    a.pieceCount > 0
      ? `I already put ${a.pieceCount} of your piece${a.pieceCount === 1 ? "" : "s"} up on your page`
      : `I built you a page`;

  switch (a.stage) {
    case "NEW":
      return (
        `Yo ${a.displayName} — Matt from The Heat Chart.\n\n` +
        `We're building the league for custom sneaker artists: head-to-head battles, a live Heat List ranking, and a market where your one-of-ones sell with your name on them. ${work} so you can see it before you commit: ${url}\n\n` +
        `It's free, and it stays free for the artists. Want me to hand you the keys?\n\n— Matt`
      );
    case "CONTACTED":
      return (
        `Hey ${a.displayName} — following up on your Heat Chart page: ${url}\n\n` +
        `No pressure at all. Claiming it takes about a minute and it's yours — your work, your record, your commissions. If it's not for you just say the word and I'll stop bugging you.\n\n— Matt`
      );
    case "IN_TALKS":
      return (
        `${a.displayName} — picking this back up. Your page is still held for you: ${url}\n\n` +
        `Want me to walk you through claiming it, or is there something you'd want changed first? Happy to set it up exactly how you want it.\n\n— Matt`
      );
    case "INVITED":
      return (
        `${a.displayName} — your claim link is still open: ${url}\n\n` +
        `Once you claim it you can post drops, take commissions with your rates listed upfront, and enter battles. Takes a minute. Want me to just do it with you over DM?\n\n— Matt`
      );
    default:
      return `Hey ${a.displayName} — checking in on your Heat Chart page: ${url}\n\n— Matt`;
  }
}

export async function getRosterRun(limit = 25): Promise<{
  items: RunItem[];
  counts: { due: number; cold: number; neverTouched: number };
}> {
  // Unclaimed pre-loaded pages only. "Never claimed" means no password AND
  // no OAuth link — a password-less account can still be a real artist who
  // signed in with Google/Facebook, and they don't belong in a queue.
  const leads = await prisma.artistProfile.findMany({
    where: {
      status: "APPROVED",
      user: { passwordHash: null, accounts: { none: {} } },
    },
    select: {
      id: true, slug: true, displayName: true, instagram: true,
      outreachStage: true, lastTouchAt: true, touchCount: true, invitedAt: true,
      user: { select: { email: true } },
      _count: { select: { submissions: true } },
    },
    take: 300,
  });

  const items: RunItem[] = [];
  for (const a of leads) {
    const stage = a.outreachStage || "NEW";
    const touch = a.lastTouchAt ?? a.invitedAt ?? null;
    const since = daysSince(touch);
    const cadence = CADENCE[stage] ?? 7;

    // Not due yet — skip.
    if (since !== null && since < cadence) continue;

    const cold = since !== null && since >= COLD_DAYS;
    let reason: string;
    let action: string;
    let priority: number;

    if (since === null) {
      reason = "Never contacted";
      action = "First contact";
      priority = 100;
    } else if (cold) {
      reason = `Going cold — ${since} days quiet`;
      action = "Last shot or archive";
      priority = 40;
    } else {
      const label: Record<string, string> = {
        CONTACTED: "No reply yet",
        IN_TALKS: "They replied — keep it moving",
        INVITED: "Claim link unused",
      };
      reason = `${label[stage] ?? "Due"} — ${since} days`;
      action = stage === "IN_TALKS" ? "Close it" : `Follow up #${a.touchCount + 1}`;
      // Warm leads that replied are the most valuable follow-up.
      priority = stage === "IN_TALKS" ? 90 : stage === "INVITED" ? 80 : 60;
    }

    // Real work on the page makes a lead far more likely to convert.
    if (a._count.submissions > 0) priority += 5;

    items.push({
      artistId: a.id,
      name: a.displayName,
      slug: a.slug,
      instagram: a.instagram,
      email: a.user?.email ?? "",
      stage,
      daysSinceTouch: since,
      touchCount: a.touchCount,
      pieceCount: a._count.submissions,
      reason,
      action,
      priority,
      cold,
      message: draftMessage({
        displayName: a.displayName,
        slug: a.slug,
        stage,
        pieceCount: a._count.submissions,
        touchCount: a.touchCount,
      }),
    });
  }

  items.sort((x, y) => y.priority - x.priority || (y.daysSinceTouch ?? 999) - (x.daysSinceTouch ?? 999));

  return {
    items: items.slice(0, limit),
    counts: {
      due: items.length,
      cold: items.filter((i) => i.cold).length,
      neverTouched: items.filter((i) => i.daysSinceTouch === null).length,
    },
  };
}

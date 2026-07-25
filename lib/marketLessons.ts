/**
 * The market, explained where the market is happening.
 *
 * The Heat Chart is already a real two-sided market: a bid, an ask, a
 * spread, a last price, a primary issue price, and a derivative written on
 * top of it. Every one of those is a first-year markets concept that most
 * people never get taught, sitting in a table about shoes they already
 * care about.
 *
 * So the teaching doesn't go in a separate course. It goes on the number.
 * Tap the spread and you learn what a spread is — using this pair's actual
 * spread, in cents, right now. The sneaker isn't a hook for a finance
 * lesson; the sneaker market IS the lesson, and the only thing missing was
 * the vocabulary.
 *
 * Two rules for everything in this file:
 *
 *  NO NUMBER IS INVENTED. A lesson that quotes a figure quotes one we
 *  actually hold. When we don't have the data, the lesson says what's
 *  missing rather than reaching for an illustrative example, because a made
 *  up number in a teaching context is worse than no number.
 *
 *  THE STREET NAME IS ALWAYS GIVEN. The point is transfer. Someone who
 *  learns "spread" here should recognise it on a brokerage screen, so every
 *  concept carries the term a trading desk would use.
 */

export type LessonValues = {
  bidCents?: number | null;
  askCents?: number | null;
  spreadCents?: number | null;
  lastCents?: number | null;
  retailCents?: number | null;
  changePct?: number | null;
  crowdUp?: number;
  crowdDown?: number;
  /** Days between the origin (release or first sale) and now. */
  heldDays?: number | null;
  side?: "OG" | "CUSTOM";
};

export type Lesson = {
  /** Stable id, also the anchor for deep links. */
  id: string;
  /** What this column is called on our screen. */
  label: string;
  /** What a trading desk calls it. The whole point is transfer. */
  street: string;
  /** Two or three sentences. The concept, not the trivia. */
  what: string[];
  /**
   * The same idea, stated with this pair's real numbers. Returns null when
   * we don't hold the data — the UI then shows only the concept.
   */
  figure?: (v: LessonValues) => string | null;
  /** Where this shows up outside sneakers. Keeps the transfer explicit. */
  elsewhere?: string;
};

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const LESSONS: Record<string, Lesson> = {
  bid: {
    id: "bid",
    label: "Bid",
    street: "Bid / the buy side",
    what: [
      "The bid is the highest price somebody is actually willing to pay right now — not what a seller is asking, and not what the last pair sold for.",
      "It's a real, live offer. If you wanted out of a position this second, the bid is what you'd get, because it's the only price with a buyer already standing behind it.",
    ],
    figure: (v) =>
      v.bidCents
        ? `Here the bid is ${usd(v.bidCents)} — used pairs currently changing hands. Sell into that today and that's your number.`
        : null,
    elsewhere:
      "On a brokerage screen this is the bid on a stock quote. Selling 'at market' means hitting the bid.",
  },

  ask: {
    id: "ask",
    label: "Ask",
    street: "Ask / offer",
    what: [
      "The ask is the lowest price a seller will currently accept. It's the price you pay if you want the thing immediately rather than waiting for someone to come down.",
      "Bid and ask together are the market. A single 'price' is a simplification — there are always two, and which one applies depends on whether you're buying or selling.",
    ],
    figure: (v) =>
      v.askCents
        ? `Here the ask is ${usd(v.askCents)} — deadstock, ready to buy now.`
        : null,
    elsewhere: "Buying 'at market' means lifting the ask. The two-sided quote works identically in equities, bonds and FX.",
  },

  spread: {
    id: "spread",
    label: "Spread",
    street: "Bid-ask spread",
    what: [
      "The spread is the gap between the bid and the ask, and it is the cost of being in a hurry. Buy at the ask and sell at the bid in the same instant and you lose the spread — that loss is the market maker's pay for standing on both sides.",
      "It's also the best single read on liquidity. A tight spread means lots of buyers and sellers agreeing closely. A wide spread means a thin market, and it warns you that getting out may cost more than you think.",
    ],
    figure: (v) => {
      if (!v.spreadCents || !v.bidCents || !v.askCents) return null;
      const mid = (v.bidCents + v.askCents) / 2;
      const pct = Math.round((v.spreadCents / mid) * 100);
      const read =
        pct <= 8
          ? "That's tight — this pair trades often, and you could get in and out without much friction."
          : pct <= 20
            ? "That's a normal spread for resale. You'd give up real money round-tripping it today."
            : "That's wide. Thin market: few buyers, and exiting quickly would cost you.";
      return `${usd(v.askCents)} ask minus ${usd(v.bidCents)} bid is a ${usd(v.spreadCents)} spread — about ${pct}% of the mid price. ${read}`;
    },
    elsewhere:
      "Apple's spread is a cent or two on a $200 stock. A thinly traded small-cap can run several percent — same signal, same warning.",
  },

  last: {
    id: "last",
    label: "Last",
    street: "Last traded price",
    what: [
      "The last price is what somebody actually paid. That makes it different in kind from the bid and the ask, which are only intentions — a price isn't real until a trade happens at it.",
      "It's also history, not a promise. The last trade might have been minutes ago or weeks ago, and nobody is obliged to repeat it.",
    ],
    figure: (v) =>
      v.lastCents ? `Last here is ${usd(v.lastCents)}.` : null,
    elsewhere:
      "The number on a stock ticker is the last trade. In an illiquid market it can be badly stale — which is why traders quote bid and ask instead.",
  },

  retail: {
    id: "retail",
    label: "Retail",
    street: "Primary market / issue price",
    what: [
      "Retail is the primary market: the price the issuer set, sold once, to whoever got through. Everything after that is the secondary market, where price is discovered by what people will actually pay.",
      "The two are almost never the same, and the gap is the entire reason resale exists. When the issuer prices below what the market will bear, that difference goes to whoever got an allocation instead of to the issuer.",
    ],
    figure: (v) =>
      v.retailCents && v.lastCents
        ? `Issued at ${usd(v.retailCents)}, trading at ${usd(v.lastCents)}. That ${usd(Math.abs(v.lastCents - v.retailCents))} gap is what the primary price missed by.`
        : v.retailCents
          ? `Issued at ${usd(v.retailCents)} on release day.`
          : null,
    elsewhere:
      "An IPO priced at $20 that opens at $85 is the same event: the underwriter set the primary price, the secondary market disagreed, and the $65 went to allocation holders rather than the company.",
  },

  change: {
    id: "change",
    label: "Chg%",
    street: "Return over issue price",
    what: [
      "This is the return measured from the primary price to now — what a pair bought at retail and held would have done, before any cost of holding it.",
      "It flatters reality, because it quietly assumes you got one at retail. Most people didn't, and the return from the secondary price is a completely different, usually much smaller number.",
    ],
    figure: (v) =>
      v.changePct !== null && v.changePct !== undefined
        ? `${v.changePct >= 0 ? "+" : ""}${v.changePct}% against issue. That return was only available to somebody who got an allocation on release day.`
        : null,
    elsewhere:
      "Same trap as quoting a fund's return from inception: it's a real number that almost no current holder actually earned.",
  },

  ladder: {
    id: "ladder",
    label: "Where last sits",
    street: "Trading near the bid / near the offer",
    what: [
      "The rail spans bid to ask, and the marker is where the last trade landed inside that band. It tells you which side is doing the compromising.",
      "Trades printing near the ask mean buyers are impatient and paying up. Trades near the bid mean sellers are the ones in a hurry. It's the cheapest read on pressure there is.",
    ],
    figure: (v) => {
      if (!v.bidCents || !v.askCents || !v.lastCents) return null;
      const span = v.askCents - v.bidCents;
      if (span <= 0) return null;
      const pos = Math.min(1, Math.max(0, (v.lastCents - v.bidCents) / span));
      if (pos >= 0.66) return "Last is printing up near the ask — buyers are paying up to get it now.";
      if (pos <= 0.33) return "Last is printing down near the bid — sellers are the ones in a hurry here.";
      return "Last is sitting mid-band — neither side is forcing it.";
    },
  },

  crowd: {
    id: "crowd",
    label: "The room",
    street: "Market-implied consensus / crowded trade",
    what: [
      "This is what everyone else's open calls say. Taken together, a crowd is a forecast — and a lopsided one tells you the expectation is already widely held.",
      "Which is exactly why the payout is bigger on the small side. If almost everyone expects a move, that expectation is already in the price, so being right with the crowd is worth less than being right against it. A trade everyone is already in has less left to give.",
    ],
    figure: (v) => {
      const up = v.crowdUp ?? 0;
      const down = v.crowdDown ?? 0;
      const total = up + down;
      if (total === 0) return "Nobody has called this one yet — no consensus to lean on or fade.";
      const upPct = Math.round((up / total) * 100);
      if (upPct >= 70 || upPct <= 30)
        return `${upPct}% of ${total} open call${total === 1 ? "" : "s"} say higher. That's a crowded trade — the minority side pays triple for exactly that reason.`;
      return `${upPct}% of ${total} open call${total === 1 ? "" : "s"} say higher. The room is split, so there's no consensus to fade.`;
    },
    elsewhere:
      "Short interest and put/call ratios are read the same way: not as truth, but as a measure of how much of a view is already priced in.",
  },

  carry: {
    id: "carry",
    label: "Cost of holding",
    street: "Cost of carry",
    what: [
      "Holding anything real costs money — storage, insurance, and the return you gave up by having cash tied up instead of earning elsewhere. That total is the cost of carry, and it eats a gain quietly while the headline price is going up.",
      "It's why a futures contract usually prices above the spot price: the future has to compensate whoever is holding the actual thing in the meantime. Ignore carry and a position that looks profitable can be losing.",
    ],
    figure: (v) => {
      if (!v.heldDays || v.heldDays < 30) return null;
      const months = Math.round(v.heldDays / 30);
      return `This one's been tracked ${months} month${months === 1 ? "" : "s"}. Any gain over that window has to clear ${months} months of holding it before it's really a gain.`;
    },
    elsewhere:
      "Gold futures price in vault storage. Oil futures price in tank storage — in 2020 that cost went so high that oil futures briefly traded below zero.",
  },

  oneofone: {
    id: "oneofone",
    label: "No two-sided market",
    street: "Illiquid / unlisted asset",
    what: [
      "A one-of-one has no bid and no ask, because there's exactly one unit and no queue of buyers and sellers standing ready. There's an asking price, and there's whatever the last one actually sold for.",
      "That's not a flaw in the data — it's what illiquidity is. Assets like this are valued from comparable sales rather than a live quote, and the honest version of that valuation always carries more uncertainty than a traded price does.",
    ],
    elsewhere:
      "Private company shares, real estate and fine art all price this way: last comparable sale plus judgement, because no continuous market exists to ask.",
  },
};

/** Ordered for a "learn the market" reading path. */
export const LESSON_ORDER = [
  "retail", "last", "bid", "ask", "spread", "ladder", "change", "crowd", "carry", "oneofone",
] as const;

export function getLesson(id: string): Lesson | null {
  return LESSONS[id] ?? null;
}

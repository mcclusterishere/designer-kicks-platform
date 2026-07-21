/**
 * HC Value Estimates — the platform's valuation engine.
 *
 * This is a MARKET-DATA product, not an appraisal. The distinction is
 * load-bearing: lenders and the IRS require USPAP-compliant appraisals
 * from qualified appraisers; a platform that calls its own number an
 * "appraisal" is exposed. What a platform CAN legitimately publish —
 * and what Artnet/Artprice built businesses on — is transparent,
 * methodology-disclosed market estimates. So every estimate here says
 * exactly what evidence it stands on, weighs arm's-length open-market
 * sales above everything else, and discounts evidence that isn't that:
 *
 *   1. Verified open-market sale of THE piece ... strongest (±15%)
 *   2. Unverified sale / disclosed prior consignment price ... (±25%)
 *   3. Artist's verified sales average (comps by the same hand) (±25%)
 *   4. Standing high bid (real committed demand) .............. (±35%)
 *   5. Ask alone (one party's opinion) ......... 60% haircut, (±35%)
 *
 * COMMISSION pieces: a commission fee is contracted income, not price
 * discovery — it enters at tier 2 weight regardless of verification,
 * and the basis says so. HX momentum nudges the middle ±10% at most.
 */

export type ValueEstimate = {
  estimateCents: number | null;
  lowCents: number | null;
  highCents: number | null;
  confidence: "strong" | "moderate" | "thin" | "none";
  basis: string[];
};

export function estimateValue(input: {
  provenanceType: string; // ORIGINAL | COMMISSION
  askingPriceCents: number | null;
  verifiedSales: { priceCents: number }[]; // newest first
  unverifiedSales: { priceCents: number }[];
  priorConsignmentSaleCents?: number | null;
  highBidCents?: number | null;
  artistAvgVerifiedCents?: number | null;
  hxWeekDelta?: number;
}): ValueEstimate {
  const basis: string[] = [];
  const commission = input.provenanceType === "COMMISSION";
  let base: number | null = null;
  let confidence: ValueEstimate["confidence"] = "none";

  const lastVerified = input.verifiedSales[0]?.priceCents ?? null;
  const lastUnverified = input.unverifiedSales[0]?.priceCents ?? null;

  if (lastVerified && !commission) {
    base = lastVerified;
    confidence = "strong";
    basis.push(`Verified open-market sale of this piece at $${Math.round(lastVerified / 100)}`);
  } else if (lastVerified && commission) {
    base = lastVerified;
    confidence = "moderate";
    basis.push(
      `Verified sale at $${Math.round(lastVerified / 100)} — commissioned work, so the price is a contracted fee, not open-market discovery`
    );
  } else if (lastUnverified) {
    base = lastUnverified;
    confidence = "moderate";
    basis.push(`Self-reported sale of this piece at $${Math.round(lastUnverified / 100)} (unverified)`);
  } else if (input.priorConsignmentSaleCents) {
    base = input.priorConsignmentSaleCents;
    confidence = "moderate";
    basis.push(
      `Disclosed prior sale at $${Math.round(input.priorConsignmentSaleCents / 100)} on the piece's consignment record`
    );
  } else if (input.artistAvgVerifiedCents) {
    base = input.artistAvgVerifiedCents;
    confidence = "moderate";
    basis.push(
      `Average of the artist's verified sales ($${Math.round(input.artistAvgVerifiedCents / 100)}) — comps by the same hand`
    );
  } else if (input.highBidCents) {
    base = input.highBidCents;
    confidence = "thin";
    basis.push(`Highest standing bid ($${Math.round(input.highBidCents / 100)}) — committed demand, no completed sale yet`);
  } else if (input.askingPriceCents) {
    base = Math.round(input.askingPriceCents * 0.6);
    confidence = "thin";
    basis.push(
      `Artist's ask ($${Math.round(input.askingPriceCents / 100)}) discounted 40% — an ask is one party's opinion, not a sale`
    );
  }

  if (base === null) {
    return {
      estimateCents: null,
      lowCents: null,
      highCents: null,
      confidence: "none",
      basis: ["No sales, bids, or asks yet — insufficient market data to estimate"],
    };
  }

  // HX momentum: capped nudge, never the story.
  const delta = input.hxWeekDelta ?? 0;
  if (delta !== 0) {
    const factor = 1 + Math.max(-50, Math.min(50, delta)) / 500; // ±10% max
    base = Math.round(base * factor);
    basis.push(`Heat Index momentum ${delta > 0 ? "+" : ""}${delta} this week (capped ±10% adjustment)`);
  }

  const spread = confidence === "strong" ? 0.15 : confidence === "moderate" ? 0.25 : 0.35;
  return {
    estimateCents: base,
    lowCents: Math.round(base * (1 - spread)),
    highCents: Math.round(base * (1 + spread)),
    confidence,
    basis,
  };
}

export const VALUATION_DISCLAIMER =
  "HC Value Estimates are informational market-data estimates produced from the platform's recorded sales, bids, and activity under a published methodology. They are not appraisals, are not USPAP-compliant valuations, and are not offers to buy. Lending, insurance, tax, and donation decisions require a qualified independent appraiser.";

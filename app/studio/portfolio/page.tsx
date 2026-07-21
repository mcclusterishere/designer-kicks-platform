import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/market";
import { computeHeatIndex, pieceHeatEvents } from "@/lib/heatIndex";
import { estimateValue, VALUATION_DISCLAIMER } from "@/lib/valuation";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "Portfolio Statement — The Heat Chart" };
export const dynamic = "force-dynamic";

/**
 * The Portfolio Statement — the document an artist hands a lender,
 * gallery, or qualified appraiser. Rendered as a white paper document
 * (prints clean from the dark site) and built ONLY from platform
 * records: verified sales, disclosed consignments, the bid book, and
 * the Heat Index. Every number cites its evidence, every estimate
 * shows its basis, and the disclaimer says exactly what this is and
 * isn't. The credibility of this page IS the product — nothing goes on
 * it that the platform can't back with a record.
 */
export default async function PortfolioStatementPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const artist = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      submissions: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        include: {
          sales: { where: { status: "CONFIRMED" }, orderBy: { soldAt: "desc" } },
          offers: { where: { status: "OPEN" }, orderBy: { amountCents: "desc" } },
          votes: { select: { createdAt: true } },
          battlesWon: { select: { createdAt: true } },
          tournamentsWon: { select: { createdAt: true } },
          ratings: { select: { stars: true, createdAt: true } },
          consignment: true,
          collaborators: { where: { status: "APPROVED" }, select: { displayName: true } },
        },
      },
    },
  });
  if (!artist || artist.status !== "APPROVED") redirect("/submit");

  // Artist-level comp: average of all verified open-market sales.
  const verifiedSales = artist.submissions
    .filter((s) => s.provenanceType !== "COMMISSION")
    .flatMap((s) => s.sales.filter((x) => x.verified));
  const artistAvgVerifiedCents =
    verifiedSales.length > 0
      ? Math.round(verifiedSales.reduce((sum, s) => sum + s.priceCents, 0) / verifiedSales.length)
      : null;

  const pieces = artist.submissions.map((s) => {
    const hx = computeHeatIndex(
      pieceHeatEvents({
        votes: s.votes,
        battlesWon: s.battlesWon,
        tournamentsWon: s.tournamentsWon,
        ratings: s.ratings,
        openOffers: s.offers,
        confirmedSales: s.sales,
      })
    );
    const estimate = estimateValue({
      provenanceType: s.provenanceType,
      askingPriceCents: s.askingPriceCents,
      verifiedSales: s.sales.filter((x) => x.verified),
      unverifiedSales: s.sales.filter((x) => !x.verified),
      priorConsignmentSaleCents: s.consignment?.priorSaleCents ?? null,
      highBidCents: s.offers[0]?.amountCents ?? null,
      artistAvgVerifiedCents,
      hxWeekDelta: hx.weekDelta,
    });
    return { s, hx, estimate };
  });

  const totals = {
    pieces: pieces.length,
    verifiedVolumeCents: artist.submissions
      .flatMap((s) => s.sales.filter((x) => x.verified))
      .reduce((sum, s) => sum + s.priceCents, 0),
    salesCount: artist.submissions.flatMap((s) => s.sales).length,
    verifiedCount: artist.submissions.flatMap((s) => s.sales.filter((x) => x.verified)).length,
    estLowCents: pieces.reduce((sum, p) => sum + (p.estimate.lowCents ?? 0), 0),
    estHighCents: pieces.reduce((sum, p) => sum + (p.estimate.highCents ?? 0), 0),
    estimatedPieces: pieces.filter((p) => p.estimate.estimateCents !== null).length,
  };

  const generated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const confLabel = { strong: "Strong", moderate: "Moderate", thin: "Thin", none: "None" } as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/studio" className="tag text-smoke hover:text-white">
          ← Studio
        </Link>
        <PrintButton />
      </div>

      {/* The document itself — white paper, dark ink, prints as-is. */}
      <div className="rounded-xl bg-white p-8 text-neutral-900 shadow-2xl print:rounded-none print:p-6 print:shadow-none sm:p-12">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">
              The Heat Chart · Equity Uprise
            </p>
            <h1 className="mt-1 text-3xl font-bold">Artist Portfolio Statement</h1>
            <p className="mt-2 text-lg font-semibold">{artist.displayName}</p>
            <p className="text-sm text-neutral-600">
              theheatchart.com/artists/{artist.slug}
              {artist.city ? ` · ${artist.city}` : ""}
              {artist.instagram ? ` · @${artist.instagram.replace(/^@/, "")}` : ""}
            </p>
          </div>
          <div className="text-right text-sm text-neutral-600">
            <p>Generated {generated}</p>
            <p>Source: platform transaction records</p>
          </div>
        </div>

        {/* Headline numbers */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Catalogued Works", value: String(totals.pieces) },
            { label: "Recorded Sales", value: `${totals.salesCount} (${totals.verifiedCount} verified)` },
            { label: "Verified Volume", value: formatUsd(totals.verifiedVolumeCents) },
            {
              label: "Est. Portfolio Range",
              value:
                totals.estimatedPieces > 0
                  ? `${formatUsd(totals.estLowCents)}–${formatUsd(totals.estHighCents)}`
                  : "—",
            },
          ].map((t) => (
            <div key={t.label} className="rounded-lg border border-neutral-200 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">{t.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>

        {/* Per-piece provenance + valuation */}
        <h2 className="mt-10 border-b border-neutral-300 pb-2 text-xl font-bold">
          Works, Provenance &amp; Estimates
        </h2>
        <div className="mt-4 space-y-6">
          {pieces.map(({ s, hx, estimate }) => (
            <div key={s.id} className="break-inside-avoid rounded-lg border border-neutral-200 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">
                  {s.title}
                  {s.collaborators.length > 0 && (
                    <span className="font-normal text-neutral-600">
                      {" "}
                      × {s.collaborators.map((c) => c.displayName).join(" × ")}
                    </span>
                  )}
                </p>
                <p className="text-sm tabular-nums text-neutral-600">
                  HX {hx.value}
                  {hx.weekDelta !== 0 && ` (${hx.weekDelta > 0 ? "+" : ""}${hx.weekDelta}/wk)`}
                </p>
              </div>
              <p className="mt-0.5 text-sm text-neutral-600">
                Custom {s.baseShoe} · {s.provenanceType === "COMMISSION" ? "Commissioned work" : "Original (open market)"} ·
                catalogued {s.createdAt.toLocaleDateString("en-US")}
              </p>

              {/* Provenance chain */}
              <ul className="mt-3 space-y-1 border-l-2 border-neutral-300 pl-3 text-sm">
                <li className="text-neutral-600">
                  Created by {artist.displayName} — catalogued on The Heat Chart{" "}
                  {s.createdAt.toLocaleDateString("en-US")}
                </li>
                {s.consignment && (
                  <li className="text-neutral-600">
                    Consignment relist ({s.consignment.status.toLowerCase()})
                    {s.consignment.priorSaleCents
                      ? ` — prior sale ${formatUsd(s.consignment.priorSaleCents)} disclosed`
                      : ""}
                    , floor {formatUsd(s.consignment.floorCents)}, {s.consignment.splitPct}% to consignor
                  </li>
                )}
                {s.sales.length === 0 && <li className="text-neutral-500">No completed sales recorded</li>}
                {[...s.sales].reverse().map((sale) => (
                  <li key={sale.id}>
                    Sold {sale.soldAt.toLocaleDateString("en-US")} —{" "}
                    <span className="font-semibold tabular-nums">{formatUsd(sale.priceCents)}</span>{" "}
                    {sale.verified ? (
                      <span className="font-semibold text-emerald-700">✓ verified ({sale.verifiedBy})</span>
                    ) : (
                      <span className="text-neutral-500">self-reported</span>
                    )}
                    {sale.note ? <span className="text-neutral-500"> — {sale.note}</span> : null}
                  </li>
                ))}
                {s.offers.length > 0 && (
                  <li className="text-neutral-600">
                    {s.offers.length} standing bid{s.offers.length === 1 ? "" : "s"}, high{" "}
                    {formatUsd(s.offers[0].amountCents)}
                  </li>
                )}
              </ul>

              {/* Estimate + its basis */}
              <div className="mt-3 rounded bg-neutral-50 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                    HC Value Estimate · confidence: {confLabel[estimate.confidence]}
                  </p>
                  <p className="font-bold tabular-nums">
                    {estimate.estimateCents !== null
                      ? `${formatUsd(estimate.lowCents!)} – ${formatUsd(estimate.highCents!)}`
                      : "Insufficient market data"}
                  </p>
                </div>
                <ul className="mt-1.5 space-y-0.5 text-xs text-neutral-600">
                  {estimate.basis.map((b, i) => (
                    <li key={i}>· {b}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Methodology + disclaimer */}
        <div className="mt-10 border-t-2 border-neutral-900 pt-4 text-xs leading-relaxed text-neutral-600">
          <p className="font-bold uppercase tracking-[0.14em] text-neutral-500">
            Methodology &amp; Limitations
          </p>
          <p className="mt-2">
            Estimates weigh evidence in strict order: verified open-market sales of the piece;
            self-reported sales and disclosed consignment prices; the artist&apos;s verified-sales
            average; standing bids; asking prices (discounted 40%). Commissioned works are treated
            as contracted-fee evidence, not open-market price discovery. Heat Index (HX) is the
            platform&apos;s activity score — votes, battle results, bids, and sales — and adjusts
            estimates by at most ±10%. Related-party relists are recorded as disclosed consignments
            and appear as such above.
          </p>
          <p className="mt-2">{VALUATION_DISCLAIMER}</p>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-smoke print:hidden">
        Taking this to a lender? Read{" "}
        <Link href="/art-capital" className="text-volt underline">
          how the art-capital program works
        </Link>{" "}
        first.
      </p>
    </div>
  );
}

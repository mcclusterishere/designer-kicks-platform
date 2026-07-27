import Link from "next/link";
import Money from "@/components/Money";
import PairChart from "@/components/PairChart";
import CallTicket from "@/components/CallTicket";
import Explain from "@/components/Explain";
import type { TradeTarget } from "@/lib/tradePanel";
import type { LessonValues } from "@/lib/marketLessons";

/**
 * One pair, everything about it, in one place.
 *
 * This is the centralisation the market was missing. Price, where that price
 * came from, and the ticket to call it used to be a catalog page, a chart
 * page and a separate predictions page — three products wearing one name.
 * Here they're one panel, and it renders identically whichever floor you're
 * on, so switching between OG and customs changes the contents rather than
 * the concept.
 */
export default function TradePanel({
  target,
  credits,
  signedIn,
  closeHref,
}: {
  target: TradeTarget;
  credits: number;
  signedIn: boolean;
  closeHref: string;
}) {
  const up = (target.changePct ?? 0) >= 0;

  const spreadCents =
    target.bidCents && target.askCents && target.askCents > target.bidCents
      ? target.askCents - target.bidCents
      : null;
  const heldDays = target.heldDays;

  // One bundle of this pair's real figures, handed to every lesson on the
  // panel so each one explains itself with these numbers rather than in the
  // abstract.
  const lessonValues: LessonValues = {
    bidCents: target.bidCents,
    askCents: target.askCents,
    spreadCents,
    lastCents: target.priceCents,
    retailCents: target.originCents,
    changePct: target.changePct,
    crowdUp: target.crowd.up,
    crowdDown: target.crowd.down,
    heldDays,
    side: target.side,
  };

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-heat/40 bg-gradient-to-br from-surface via-surface to-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-edge p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          {target.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={target.imageUrl}
              alt={target.name}
              className="h-16 w-16 shrink-0 rounded-lg bg-panel object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="tag text-heat">
              {target.side === "OG" ? "Retail pair" : "One of one"} · {target.symbol.slice(0, 20)}
            </p>
            <h2 className="display truncate text-2xl text-white">{target.name}</h2>
            <p className="tag truncate text-smoke">{target.sub}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="display text-3xl leading-none text-white">
            <Money cents={target.priceCents} showUsd={false} />
          </p>
          {target.changePct !== null && (
            <p className={`tag mt-0.5 font-bold ${up ? "text-heat" : "text-volt"}`}>
              {up ? "▲" : "▼"} {Math.abs(target.changePct)}% since {target.originLabel.toLowerCase()}
            </p>
          )}
          <Link href={closeHref} className="tag mt-1 inline-block text-smoke underline hover:text-white">
            close
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-5">
        {/* Where the price came from */}
        <div className="lg:col-span-3">
          {target.track.length >= 2 ? (
            <PairChart points={target.track} name={target.name} sku={target.symbol} />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-edge">
              <p className="px-4 text-center text-xs text-smoke">
                {target.side === "CUSTOM"
                  ? "No sale history on this piece yet — the line starts at its first confirmed sale."
                  : "Not enough readings to draw a line yet. It fills in as prices are recorded."}
              </p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label={target.originLabel}
              lesson={target.side === "OG" ? "retail" : undefined}
              values={lessonValues}
              value={<Money cents={target.originCents} showUsd={false} />}
            />
            <Stat
              label="Now"
              lesson="last"
              values={lessonValues}
              value={<Money cents={target.priceCents} showUsd={false} />}
            />
            <Stat
              label={target.originAt ? "Since" : "Tracked from"}
              lesson={heldDays && heldDays >= 30 ? "carry" : undefined}
              values={lessonValues}
              value={
                <span className="text-base">
                  {target.originAt
                    ? target.originAt.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
                    : "—"}
                </span>
              }
            />
          </div>

          {/* The live two-sided quote. The table shows this and the panel
              used to drop it, which meant tapping a row lost the only
              picture of the actual market. It's also where the vocabulary
              is densest, so every leg carries its lesson. */}
          {target.bidCents || target.askCents ? (
            <div className="mt-3 rounded-xl border border-edge bg-surface p-3">
              <p className="tag text-smoke">
                Live market
                <span className="ml-1.5 normal-case text-smoke/70">· eBay used vs deadstock</span>
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <Leg label="Bid" lesson="bid" values={lessonValues} cents={target.bidCents} tone="text-volt" />
                <Leg label="Ask" lesson="ask" values={lessonValues} cents={target.askCents} tone="text-heat" />
                <Leg label="Spread" lesson="spread" values={lessonValues} cents={spreadCents} tone="text-white" />
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-edge p-3">
              <p className="tag text-smoke">
                No two-sided market
                <Explain lesson="oneofone" values={lessonValues} />
              </p>
              <p className="mt-1 text-xs leading-relaxed text-smoke">
                One unit, no queue of buyers and sellers — so there&apos;s an asking price
                and a sale record, but no bid and no ask.
              </p>
            </div>
          )}
        </div>

        {/* The ticket */}
        <div className="lg:col-span-2">
          <CallTicket
            side={target.side}
            targetId={target.id}
            basisCents={target.priceCents}
            credits={credits}
            crowd={target.crowd}
            signedIn={signedIn}
          />

          {target.yourCalls.length > 0 && (
            <div className="mt-3 rounded-xl border border-edge bg-surface p-3">
              <p className="tag text-smoke">Your open calls on this one</p>
              <div className="mt-1.5 space-y-1">
                {target.yourCalls.map((c) => (
                  <p key={c.id} className="tag text-white">
                    {c.kind === "DIRECTION"
                      ? c.direction === "UP" ? "▲ higher" : "▼ lower"
                      : `called ${Math.round((c.predictedCents ?? 0) / 100)}`}
                    {" · "}{c.horizonDays}d
                    {c.stakeCredits > 0 && <span className="text-heat"> · {c.stakeCredits} staked</span>}
                    <span className="text-smoke">
                      {" · "}
                      {Math.max(0, Math.ceil((c.resolveAt.getTime() - Date.now()) / 86400000))}d left
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  lesson,
  values,
}: {
  label: string;
  value: React.ReactNode;
  lesson?: string;
  values?: LessonValues;
}) {
  return (
    <div className="rounded-lg border border-edge bg-surface p-3">
      <p className="tag text-smoke">
        {label}
        {lesson && <Explain lesson={lesson} values={values} />}
      </p>
      <p className="display mt-0.5 text-xl text-white">{value}</p>
    </div>
  );
}

/** One leg of the two-sided quote, with the concept behind it attached. */
function Leg({
  label,
  lesson,
  values,
  cents,
  tone,
}: {
  label: string;
  lesson: string;
  values: LessonValues;
  cents: number | null;
  tone: string;
}) {
  return (
    <div>
      <p className="tag text-smoke">
        {label}
        <Explain lesson={lesson} values={values} />
      </p>
      <p className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${tone}`}>
        {cents ? <Money cents={cents} showUsd={false} /> : "—"}
      </p>
    </div>
  );
}

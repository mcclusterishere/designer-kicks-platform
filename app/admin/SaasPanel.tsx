import Link from "next/link";
import { saasMetrics, claimFunnel, monthsToGoal } from "@/lib/saas";
import { FOUNDING_SEATS } from "@/lib/founding";
import { priceLabel, PRICE_MONTHLY_CENTS } from "@/lib/plans";

/**
 * The subscription business at a glance.
 *
 * Ordered by what's actually blocking growth rather than by what looks
 * best. Right now that means the claim funnel sits above MRR: a roster of
 * pages nobody has logged into can't be converted into subscribers no
 * matter how good the billing is, and a dashboard that leads with a
 * flattering "24 artists" hides the number that matters.
 */

/** A first blank run at a small factory — the goal the MRR is funding. */
const BLANK_RUN_GOAL_CENTS = 250_000; // 100 pairs at ~$25 FOB

function Stat({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "plain" | "good" | "bad";
}) {
  const colour = tone === "good" ? "text-volt" : tone === "bad" ? "text-heat" : "text-white";
  return (
    <div className="rounded-lg border border-edge bg-panel px-3 py-2.5">
      <p className="tag text-smoke">{label}</p>
      <p className={`display mt-0.5 text-2xl tabular-nums ${colour}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-smoke">{sub}</p>}
    </div>
  );
}

export default async function SaasPanel() {
  const [m, funnel] = await Promise.all([saasMetrics(), claimFunnel()]);

  const unclaimed = funnel.filter((f) => !f.claimed);
  const claimedFree = funnel.filter((f) => f.claimed && !f.paying);
  const months = monthsToGoal(m.mrrCents, BLANK_RUN_GOAL_CENTS);

  return (
    <div className="space-y-8">
      {/* The bottleneck, first. */}
      <section className="rounded-xl border border-heat/40 bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl text-white">The funnel</h2>
          <p className="tag text-smoke">Pages → claimed → posting → paying</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Artist pages" value={String(m.pages)} sub="Including ones we built" />
          <Stat
            label="Actually claimed"
            value={String(m.claimed)}
            tone={m.claimRatePct < 50 ? "bad" : "plain"}
            sub={`${m.claimRatePct}% of pages`}
          />
          <Stat label="Claimed + posting" value={String(m.active)} sub="Real users" />
          {/* Founding seats sit BESIDE paying, never inside it. They are
              the answer to "will artists use the business tools", which
              is the question that comes before "will they pay for them" —
              and folding them together would report a hundred customers
              against zero revenue. */}
          <Stat
            label="Founding 100"
            value={`${m.founding} / ${FOUNDING_SEATS}`}
            tone={m.founding > 0 ? "good" : "plain"}
            sub={`${FOUNDING_SEATS - m.founding} seats left · free, no card`}
          />
          <Stat
            label="Paying"
            value={String(m.paying)}
            tone={m.paying > 0 ? "good" : "plain"}
            sub={`${m.conversionPct}% of claimed · real money only`}
          />
        </div>

        {unclaimed.length > 0 && (
          <p className="mt-3 text-sm text-smoke">
            <span className="font-bold text-heat">{unclaimed.length} pages nobody has logged
            into.</span>{" "}
            These are the cheapest subscribers available — the page already exists and the work is
            already on it. Nothing else moves until this number comes down.
          </p>
        )}
      </section>

      {/* Revenue. */}
      <section className="rounded-xl border border-volt/40 bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl text-white">Subscription revenue</h2>
          <p className="tag text-smoke">Live subscriptions only</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="MRR" value={priceLabel(m.mrrCents)} tone={m.mrrCents > 0 ? "good" : "plain"} />
          <Stat label="Run rate" value={priceLabel(m.runRateCents)} sub="MRR × 12 — a projection" />
          <Stat label="ARPU" value={priceLabel(m.arpuCents)} />
          <Stat
            label="Churn (30d)"
            value={`${m.churnPct}%`}
            tone={m.churnPct > 5 ? "bad" : "plain"}
          />
          <Stat
            label="Card trouble"
            value={String(m.atRisk)}
            tone={m.atRisk > 0 ? "bad" : "plain"}
            sub="Still has access"
          />
          <Stat label="Winding down" value={String(m.windingDown)} sub="Cancelled, not expired" />
        </div>
        <p className="mt-3 text-xs text-smoke">
          Cancelled subscribers still inside their paid period keep access but are out of MRR —
          that money already arrived and is leaving. Annual plans are counted at a twelfth, not as
          a month.
        </p>
      </section>

      {/* What the money is for. */}
      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="display text-xl text-white">Runway to a blank run</h2>
        <p className="mt-1 text-sm text-smoke">
          Against {priceLabel(BLANK_RUN_GOAL_CENTS)} — roughly 100 pairs at a small factory,
          before tooling, freight and duty.
        </p>
        {months === null ? (
          <p className="mt-3 text-sm text-heat">
            No recurring revenue yet, so there&apos;s no date to give you. At{" "}
            {priceLabel(PRICE_MONTHLY_CENTS)}/mo it takes{" "}
            {Math.ceil(BLANK_RUN_GOAL_CENTS / PRICE_MONTHLY_CENTS / 12)} artists paying for a year,
            or half that for two. Pre-orders get there faster than subscriptions will.
          </p>
        ) : (
          <p className="mt-3 text-sm text-white">
            At today&apos;s MRR: <span className="font-bold text-volt">{months} months</span>.{" "}
            <span className="text-smoke">
              Every additional subscriber at {priceLabel(PRICE_MONTHLY_CENTS)} pulls that in.
            </span>
          </p>
        )}
      </section>

      {/* The work list. */}
      <section className="rounded-xl border border-edge bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl text-white">Who to chase</h2>
          <p className="tag text-smoke">{unclaimed.length} unclaimed · {claimedFree.length} claimed but free</p>
        </div>

        {unclaimed.length > 0 && (
          <>
            <p className="mt-3 tag text-heat">Never logged in</p>
            <ul className="mt-1.5 space-y-1 text-sm">
              {unclaimed.slice(0, 15).map((f) => (
                <li key={f.slug} className="text-smoke">
                  <Link href={`/artists/${f.slug}`} className="text-white hover:text-volt">
                    {f.displayName}
                  </Link>{" "}
                  · {f.pieces} {f.pieces === 1 ? "piece" : "pieces"} up · {f.stage}
                  {f.daysSinceTouch !== null
                    ? ` · ${f.daysSinceTouch}d since last touch`
                    : " · never contacted"}
                </li>
              ))}
            </ul>
          </>
        )}

        {claimedFree.length > 0 && (
          <>
            <p className="mt-4 tag text-volt">Logged in, not paying</p>
            <p className="text-xs text-smoke">
              These already chose to be here. They&apos;re the ones to actually pitch Pro to.
            </p>
            <ul className="mt-1.5 space-y-1 text-sm">
              {claimedFree.slice(0, 15).map((f) => (
                <li key={f.slug} className="text-smoke">
                  <Link href={`/artists/${f.slug}`} className="text-white hover:text-volt">
                    {f.displayName}
                  </Link>{" "}
                  · {f.pieces} {f.pieces === 1 ? "piece" : "pieces"} up
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

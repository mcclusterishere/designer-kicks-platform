import {
  shelf,
  shelfSnapshot,
  realizedPnl,
  sellThrough,
  channelPnl,
  CHANNEL_FEE_PCT,
} from "@/lib/reseller";
import { removeInventoryItem, toggleInventoryListing } from "@/app/actions";
import InventoryForm from "./InventoryForm";
import SellForm from "./SellForm";

function usd(cents: number): string {
  const neg = cents < 0;
  const s = (Math.abs(cents) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return neg ? `−${s}` : s;
}

/** Red for a loss, green for a gain — never both the same colour. */
function Signed({ cents, className = "" }: { cents: number; className?: string }) {
  return (
    <span className={`tabular-nums ${cents < 0 ? "text-heat" : "text-volt"} ${className}`}>
      {cents >= 0 ? "+" : ""}
      {usd(cents)}
    </span>
  );
}

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

/**
 * The reseller desk — pairs the house owns, what they cost, what they're
 * worth, and what actually cleared.
 *
 * Deliberately leads with realised profit rather than inventory value.
 * Unrealised gains are the number that feels best and means least: a
 * shelf "worth" $40k at comp is worth nothing until it sells, and comps
 * move. Realised profit is money that arrived.
 */
export default async function ResellerDesk() {
  const [snap, pnl, st, chans, rows] = await Promise.all([
    shelfSnapshot(),
    realizedPnl(90),
    sellThrough(90),
    channelPnl(90),
    shelf(200),
  ]);

  const stale = rows.filter((r) => r.daysHeld > 90);
  const underwater = rows.filter((r) => r.underwater);

  return (
    <div className="space-y-8">
      {/* Realised first. This is the only section that describes money
          that actually arrived. */}
      <section className="rounded-xl border border-volt/40 bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl text-white">Realised — last 90 days</h2>
          <p className="tag text-smoke">Money that actually landed</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Profit"
            value={usd(pnl.profitCents)}
            tone={pnl.profitCents < 0 ? "bad" : "good"}
            sub={`${pnl.winners}W · ${pnl.losers}L`}
          />
          <Stat label="Gross" value={usd(pnl.grossCents)} sub={`${pnl.sold} pairs sold`} />
          <Stat label="Cost of goods" value={usd(pnl.costCents)} />
          <Stat
            label="Fees + shipping"
            value={usd(pnl.feeCents + pnl.shipCents)}
            sub="Off the top, before profit"
          />
          <Stat label="Margin" value={`${pnl.marginPct}%`} sub={`ROI ${pnl.roiPct}%`} />
          <Stat
            label="Avg hold"
            value={pnl.avgDaysHeld === null ? "—" : `${pnl.avgDaysHeld}d`}
            sub={`Sell-through ${st.pct}%`}
          />
        </div>
        {pnl.sold === 0 && (
          <p className="mt-3 text-sm text-smoke">
            Nothing sold in the window yet. These fill in the first time you record a sale.
          </p>
        )}
      </section>

      {/* Then the shelf — capital tied up, and how long it's been tied up. */}
      <section className="rounded-xl border border-edge bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl text-white">On the shelf</h2>
          <p className="tag text-smoke">{snap.count} pairs · capital tied up</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="At cost" value={usd(snap.atCostCents)} sub="What you paid" />
          <Stat
            label="Carrying value"
            value={usd(snap.atMarketCents)}
            sub="Lower of cost or comp"
          />
          <Stat
            label="Unrealised"
            value={`${snap.unrealizedCents >= 0 ? "+" : "−"}${usd(Math.abs(snap.unrealizedCents))}`}
            tone={snap.unrealizedCents < 0 ? "bad" : "plain"}
            sub="Not profit until it sells"
          />
          <Stat
            label="Dead capital"
            value={usd(snap.aging[3].atCostCents)}
            tone={snap.aging[3].count > 0 ? "bad" : "plain"}
            sub={`${snap.aging[3].count} pairs sitting 90+ days`}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {snap.aging.map((a) => (
            <span
              key={a.label}
              className="rounded-full border border-edge px-3 py-1 text-xs text-smoke"
            >
              {a.label}: <span className="font-bold text-white">{a.count}</span>{" "}
              <span className="tabular-nums">({usd(a.atCostCents)})</span>
            </span>
          ))}
        </div>

        {snap.noCompCount > 0 && (
          <p className="mt-3 text-xs text-smoke">
            {snap.noCompCount} pair{snap.noCompCount === 1 ? " has" : "s have"} no market comp —
            add a matching SKU to value {snap.noCompCount === 1 ? "it" : "them"} against the
            catalog. Until then {snap.noCompCount === 1 ? "it carries" : "they carry"} at cost.
          </p>
        )}
      </section>

      {/* Attention: the two lists that cost real money if ignored. */}
      {(stale.length > 0 || underwater.length > 0) && (
        <section className="rounded-xl border border-heat/40 bg-surface p-5">
          <h2 className="display text-xl text-heat">Needs a decision</h2>
          {underwater.length > 0 && (
            <div className="mt-3">
              <p className="tag text-white">
                {underwater.length} pair{underwater.length === 1 ? "" : "s"} can&apos;t clear cost
                at today&apos;s comp
              </p>
              <p className="mt-1 text-xs text-smoke">
                The market price is below what you&apos;d need to break even after fees. Holding is
                a bet the comp recovers; selling now books a known loss instead of a growing one.
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {underwater.slice(0, 8).map((r) => (
                  <li key={r.id} className="text-smoke">
                    <span className="text-white">{r.name}</span> · {r.size} · paid{" "}
                    {usd(r.costCents)}, comp {r.compCents === null ? "—" : usd(r.compCents)}, need{" "}
                    <span className="text-heat">{usd(r.floorCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {stale.length > 0 && (
            <div className="mt-4">
              <p className="tag text-white">
                {stale.length} pair{stale.length === 1 ? "" : "s"} sitting 90+ days
              </p>
              <p className="mt-1 text-xs text-smoke">
                {usd(stale.reduce((t, r) => t + r.costCents, 0))} of capital that isn&apos;t
                working. Every one of these is money you can&apos;t spend on stock that moves.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Where the money comes from. */}
      {chans.length > 0 && (
        <section className="rounded-xl border border-edge bg-surface p-5">
          <h2 className="display text-xl text-white">By channel — 90 days</h2>
          <p className="mt-1 text-xs text-smoke">
            Fee rates applied: {Object.entries(CHANNEL_FEE_PCT)
              .filter(([, p]) => p > 0)
              .map(([c, p]) => `${c} ${p}%`)
              .join(" · ")}, plus {2.9}% + 30¢ card on all of them.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="tag text-smoke">
                <tr>
                  <th className="py-1.5 pr-4">Channel</th>
                  <th className="py-1.5 pr-4 text-right">Sold</th>
                  <th className="py-1.5 pr-4 text-right">Gross</th>
                  <th className="py-1.5 pr-4 text-right">Profit</th>
                  <th className="py-1.5 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {chans.map((c) => (
                  <tr key={c.channel} className="border-t border-edge">
                    <td className="py-1.5 pr-4 text-white">{c.channel}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-smoke">{c.sold}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-smoke">
                      {usd(c.grossCents)}
                    </td>
                    <td className="py-1.5 pr-4 text-right">
                      <Signed cents={c.profitCents} />
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-smoke">{c.marginPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add stock. */}
      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="display text-xl text-white">Add a pair</h2>
        <p className="mt-1 text-xs text-smoke">
          Cost is landed cost — price paid plus tax and inbound shipping. Every margin on this
          page is computed from it, so a low number here flatters everything downstream.
        </p>
        <div className="mt-4">
          <InventoryForm />
        </div>
      </section>

      {/* The shelf itself, oldest first — aging stock needs the attention. */}
      <section className="rounded-xl border border-edge bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl text-white">The shelf</h2>
          <p className="tag text-smoke">Oldest first</p>
        </div>

        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-smoke">
            Nothing on the shelf yet. Add a pair above and the numbers start building.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-edge bg-panel p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">
                      {r.name}{" "}
                      <span className="text-smoke">
                        · {r.size} · {r.condition}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-smoke">
                      Paid <span className="text-white tabular-nums">{usd(r.costCents)}</span>
                      {" · "}
                      {r.daysHeld}d held
                      {r.compCents !== null && (
                        <>
                          {" · comp "}
                          <span className="tabular-nums text-white">{usd(r.compCents)}</span>
                        </>
                      )}
                      {r.compCents === null && " · no comp (add a SKU)"}
                      {r.listPriceCents !== null && (
                        <>
                          {" · asking "}
                          <span className="tabular-nums text-white">{usd(r.listPriceCents)}</span>
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs">
                      {r.underwater ? (
                        <span className="text-heat">
                          Under water — needs {usd(r.floorCents)} to break even after fees
                        </span>
                      ) : (
                        <span className="text-smoke">
                          Suggested ask{" "}
                          <span className="font-bold text-volt tabular-nums">
                            {usd(r.suggestCents)}
                          </span>{" "}
                          · break-even {usd(r.floorCents)}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <form action={toggleInventoryListing}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        className={`rounded border px-2 py-1 tag transition ${
                          r.publicListed
                            ? "border-volt text-volt"
                            : "border-edge text-smoke hover:text-white"
                        }`}
                        title={
                          r.listPriceCents === null
                            ? "Set an asking price before listing it publicly"
                            : undefined
                        }
                      >
                        {r.publicListed ? "On the storefront" : "List on site"}
                      </button>
                    </form>
                    <form action={removeInventoryItem}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded border border-edge px-2 py-1 tag text-smoke transition hover:border-heat hover:text-heat">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>

                <details className="mt-2.5">
                  <summary className="cursor-pointer tag text-smoke hover:text-white">
                    Record a sale
                  </summary>
                  <div className="mt-2">
                    <SellForm id={r.id} suggestCents={r.suggestCents} />
                  </div>
                </details>

                <details className="mt-1.5">
                  <summary className="cursor-pointer tag text-smoke hover:text-white">
                    Edit
                  </summary>
                  <div className="mt-2">
                    <InventoryForm
                      defaults={{
                        id: r.id,
                        name: r.name,
                        sku: r.sku,
                        brand: r.brand,
                        size: r.size,
                        condition: r.condition,
                        costCents: r.costCents,
                        listPriceCents: r.listPriceCents,
                        acquiredFrom: r.acquiredFrom,
                        notes: r.notes,
                        imageUrl: r.imageUrl,
                        publicListed: r.publicListed,
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

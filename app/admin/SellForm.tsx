"use client";

import { useActionState, useState } from "react";
import { sellInventoryItem, type ActionResult } from "@/app/actions";
import { estimateFeeCents, CHANNEL_FEE_PCT } from "@/lib/reseller";

const input =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

const CHANNELS = [
  ["heatchart", "The Heat Chart"],
  ["ebay", "eBay"],
  ["goat", "GOAT"],
  ["stockx", "StockX"],
  ["in-person", "In person"],
  ["other", "Other"],
] as const;

function usd(cents: number): string {
  const neg = cents < 0;
  const s = (Math.abs(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  return neg ? `−${s}` : s;
}

/**
 * Recording a sale, with the take shown live.
 *
 * The estimate updates as you type so the fee is visible BEFORE the sale
 * is committed, not discovered in a payout statement two weeks later.
 * It only ever pre-fills — whatever is typed in the fee box wins, because
 * the real settlement is the number that belongs in the ledger.
 */
export default function SellForm({ id, suggestCents }: { id: string; suggestCents: number }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    sellInventoryItem,
    null
  );
  const [price, setPrice] = useState("");
  const [channel, setChannel] = useState<string>("heatchart");
  const [fee, setFee] = useState("");

  const grossCents = Math.round((Number(price.replace(/[$,]/g, "")) || 0) * 100);
  const estFee = grossCents > 0 ? estimateFeeCents(grossCents, channel) : 0;
  const usedFee = fee.trim() ? Math.round((Number(fee.replace(/[$,]/g, "")) || 0) * 100) : estFee;
  const netCents = grossCents - usedFee;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="tag text-smoke" htmlFor={`s-price-${id}`}>
            Sold for * ($)
          </label>
          <input
            id={`s-price-${id}`}
            name="soldPrice"
            required
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={(suggestCents / 100).toFixed(0)}
            className={input}
          />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor={`s-chan-${id}`}>
            Channel
          </label>
          <select
            id={`s-chan-${id}`}
            name="soldChannel"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className={input}
          >
            {CHANNELS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
                {CHANNEL_FEE_PCT[v] > 0 ? ` — ${CHANNEL_FEE_PCT[v]}%` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="tag text-smoke" htmlFor={`s-fee-${id}`}>
            Fees taken ($)
          </label>
          <input
            id={`s-fee-${id}`}
            name="fee"
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder={grossCents > 0 ? (estFee / 100).toFixed(2) : "auto"}
            className={input}
          />
          <p className="mt-1 text-[11px] text-smoke">Blank uses the estimate.</p>
        </div>
        <div>
          <label className="tag text-smoke" htmlFor={`s-ship-${id}`}>
            You paid to ship ($)
          </label>
          <input id={`s-ship-${id}`} name="ship" inputMode="decimal" placeholder="0.00" className={input} />
        </div>
      </div>

      <div>
        <label className="tag text-smoke" htmlFor={`s-date-${id}`}>
          Sold on
        </label>
        <input id={`s-date-${id}`} name="soldAt" type="date" className={`${input} sm:w-52`} />
      </div>

      {grossCents > 0 && (
        <p className="rounded border border-edge bg-panel px-3 py-2 text-sm text-smoke">
          {usd(grossCents)} gross − {usd(usedFee)} fees ={" "}
          <span className="font-bold text-white tabular-nums">{usd(netCents)}</span> before
          shipping. <span className="text-smoke">Profit lands once this is saved against cost.</span>
        </p>
      )}

      {state && !state.ok && (
        <p role="alert" className="rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}

      <button
        disabled={pending}
        className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
      >
        {pending ? "Saving…" : "Record the sale"}
      </button>
    </form>
  );
}

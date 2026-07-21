"use client";

import { useState } from "react";

type Rate = { carrier: string; service: string; rateUsd: number; days: number | null };

/**
 * Seller's shipping panel — shows under a piece the moment its sale
 * goes pending, because that's the minute the box becomes real. Quotes
 * live rates when the shipping key is connected; until then it gives
 * the honest manual playbook instead of a dead button.
 */
export default function ShippingQuote() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function quote() {
    setBusy(true);
    setNote(null);
    setRates(null);
    try {
      const res = await fetch(`/api/shipping/rates?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const json = await res.json();
      if (json.ok) setRates(json.rates);
      else if (json.configured === false)
        setNote(
          "Live quotes switch on when the shipping key is connected. Until then: USPS Priority shoebox usually runs $12–18 coast to coast, insure for the sale price, signature required over $200."
        );
      else setNote(json.detail ?? "Couldn't quote that lane.");
    } catch {
      setNote("Couldn't reach the quote service — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-md border border-edge bg-panel p-2.5">
      <p className="tag text-smoke">Ship it — quote the lane</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          inputMode="numeric"
          maxLength={10}
          placeholder="from ZIP"
          aria-label="Ship from ZIP code"
          className="w-full min-w-0 rounded-md border border-edge bg-surface px-2.5 py-2 text-sm tabular-nums text-white placeholder:text-smoke/60 focus:border-volt focus:outline-none"
        />
        <span className="text-smoke">→</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          inputMode="numeric"
          maxLength={10}
          placeholder="to ZIP"
          aria-label="Ship to ZIP code"
          className="w-full min-w-0 rounded-md border border-edge bg-surface px-2.5 py-2 text-sm tabular-nums text-white placeholder:text-smoke/60 focus:border-volt focus:outline-none"
        />
        <button
          onClick={quote}
          disabled={busy || !from || !to}
          className="tag shrink-0 rounded-md border border-edge px-3 py-2 text-white transition hover:border-volt disabled:opacity-50"
        >
          {busy ? "…" : "Quote"}
        </button>
      </div>
      {rates && (
        <ul className="mt-2 space-y-1">
          {rates.slice(0, 4).map((r) => (
            <li key={`${r.carrier}-${r.service}`} className="flex items-center justify-between text-xs">
              <span className="text-smoke">
                {r.carrier} {r.service}
                {r.days ? ` · ${r.days}d` : ""}
              </span>
              <span className="font-bold tabular-nums text-white">${r.rateUsd.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mt-2 text-xs leading-relaxed text-smoke">{note}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * Shows a USD amount in the visitor's own money. Currency is guessed
 * from the device's locale region (a scout in Lagos sees ₦, Manila
 * sees ₱) with a picker to switch. Rates ride /api/fx (free, cached).
 * Renders nothing until rates arrive — USD readers see no change.
 */

const REGION_CURRENCY: Record<string, string> = {
  NG: "NGN", PH: "PHP", IN: "INR", GB: "GBP", MX: "MXN", BR: "BRL",
  CO: "COP", KE: "KES", GH: "GHS", ZA: "ZAR", PK: "PKR", ID: "IDR",
  VN: "VND", CA: "CAD", AU: "AUD", JP: "JPY", TR: "TRY", EG: "EGP",
  AR: "ARS", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR",
  PT: "EUR", IE: "EUR",
};

function guessCurrency(): string | null {
  try {
    const loc = new Intl.Locale(navigator.language);
    const region = loc.region ?? loc.maximize().region;
    return region ? REGION_CURRENCY[region] ?? null : null;
  } catch {
    return null;
  }
}

export default function LocalPay({
  usd,
  className = "",
}: {
  /** Amount in US dollars, e.g. 0.5 for the per-page rate. */
  usd: number;
  className?: string;
}) {
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [live, setLive] = useState(true);
  const [currency, setCurrency] = useState<string | null>(null);

  useEffect(() => {
    setCurrency(guessCurrency());
    fetch("/api/fx")
      .then((r) => r.json())
      .then((d) => {
        setRates(d.rates);
        setLive(Boolean(d.live));
      })
      .catch(() => {});
  }, []);

  if (!rates) return null;
  const options = Object.keys(rates).sort();
  const active = currency && rates[currency] ? currency : null;

  const formatted = active
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: active,
        maximumFractionDigits: usd * rates[active] < 10 ? 2 : 0,
      }).format(usd * rates[active])
    : null;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {formatted && (
        <span className="tag text-heat">
          ≈ {formatted}
          {!live && "*"}
        </span>
      )}
      <select
        aria-label="Show pay in your currency"
        value={active ?? ""}
        onChange={(e) => setCurrency(e.target.value || null)}
        className="rounded border border-edge bg-panel px-1 py-0.5 text-[10px] text-smoke"
      >
        <option value="">USD</option>
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </span>
  );
}

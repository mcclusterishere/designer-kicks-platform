"use client";

import { useEffect, useState } from "react";

/**
 * Quiet local-currency companion for any USD figure on the site: the
 * dollar number stays canonical, this whispers "≈ ₦1.0M" beside it in
 * the visitor's own money, guessed from their device locale. Renders
 * nothing for US visitors or before rates arrive — zero layout shift
 * for the home crowd. Rates ride /api/fx (free, cached, honest "*"
 * marker when the table is a stale fallback).
 */

// Region → currency. Currencies marked (ECB) come back live from
// Frankfurter; the rest resolve from the fallback table, which is why
// every conversion is prefixed "≈" and never presented as a real quote.
const REGION_CURRENCY: Record<string, string> = {
  // Eurozone (ECB)
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", PT: "EUR",
  IE: "EUR", BE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", SK: "EUR",
  SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR", LU: "EUR", CY: "EUR",
  MT: "EUR", HR: "EUR",
  // Rest of Europe (ECB)
  GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
  CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", IS: "ISK", TR: "TRY",
  // Americas
  CA: "CAD", MX: "MXN", BR: "BRL", CO: "COP", AR: "ARS", CL: "CLP", PE: "PEN",
  // Asia-Pacific (ECB)
  JP: "JPY", CN: "CNY", HK: "HKD", SG: "SGD", KR: "KRW", IN: "INR",
  ID: "IDR", MY: "MYR", TH: "THB", PH: "PHP", AU: "AUD", NZ: "NZD",
  VN: "VND", PK: "PKR", BD: "BDT", LK: "LKR",
  // Middle East + Africa
  IL: "ILS", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD",
  ZA: "ZAR", NG: "NGN", KE: "KES", GH: "GHS", EG: "EGP", MA: "MAD",
  TZ: "TZS", UG: "UGX", ET: "ETB", CI: "XOF", SN: "XOF", CM: "XAF",
};

// One fetch per page, shared by every LocalMoney on it.
let ratesPromise: Promise<{ rates: Record<string, number>; live: boolean } | null> | null = null;
function loadRates() {
  ratesPromise ??= fetch("/api/fx")
    .then((r) => r.json())
    .catch(() => null);
  return ratesPromise;
}

export default function LocalMoney({
  usd,
  className = "",
}: {
  usd: number;
  className?: string;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let region: string | undefined;
    try {
      const loc = new Intl.Locale(navigator.language);
      region = loc.region ?? loc.maximize().region;
    } catch {}
    const currency = region ? REGION_CURRENCY[region] : undefined;
    if (!currency || !usd) return;
    loadRates().then((d) => {
      const rate = d?.rates?.[currency];
      if (!rate) return;
      const amount = usd * rate;
      const formatted = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        notation: amount >= 100_000 ? "compact" : "standard",
        maximumFractionDigits: amount < 10 ? 2 : 0,
      }).format(amount);
      setLabel(`≈ ${formatted}${d?.live === false ? "*" : ""}`);
    });
  }, [usd]);

  if (!label) return null;
  return <span className={`tag text-heat ${className}`}>{label}</span>;
}

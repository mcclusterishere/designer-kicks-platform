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

const REGION_CURRENCY: Record<string, string> = {
  NG: "NGN", PH: "PHP", IN: "INR", GB: "GBP", MX: "MXN", BR: "BRL",
  CO: "COP", KE: "KES", GH: "GHS", ZA: "ZAR", PK: "PKR", ID: "IDR",
  VN: "VND", CA: "CAD", AU: "AUD", JP: "JPY", TR: "TRY", EG: "EGP",
  AR: "ARS", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR",
  PT: "EUR", IE: "EUR",
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

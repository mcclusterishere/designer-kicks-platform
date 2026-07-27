import { NextResponse } from "next/server";

/**
 * Free currency rates for the international scout program — served
 * from our own domain so every surface (careers page, Editor Desk)
 * can convert USD pay into a scout's home currency.
 *
 * Source: Frankfurter (api.frankfurter.dev) — free, keyless, European
 * Central Bank reference rates, ~30 currencies. Cached in-process for
 * 12 hours; a baked-in fallback table keeps conversions working even
 * if the API is unreachable (marked stale so the UI can say "approx").
 */

const TTL_MS = 12 * 60 * 60 * 1000;

// Approximate fallbacks (mid-2026) — good enough to be honest about
// ("≈"), never presented as live.
const FALLBACK: Record<string, number> = {
  EUR: 0.92, GBP: 0.78, CHF: 0.88, SEK: 10.5, NOK: 10.8, DKK: 6.9,
  PLN: 3.95, CZK: 23, HUF: 355, RON: 4.6, BGN: 1.8, ISK: 138, TRY: 34,
  CAD: 1.36, MXN: 18.4, BRL: 5.4, COP: 4100, ARS: 940, CLP: 950, PEN: 3.75,
  JPY: 155, CNY: 7.2, HKD: 7.8, SGD: 1.34, KRW: 1370, INR: 84,
  IDR: 16200, MYR: 4.5, THB: 35, PHP: 57, AUD: 1.5, NZD: 1.64,
  VND: 25400, PKR: 278, BDT: 120, LKR: 300,
  ILS: 3.7, AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31,
  ZAR: 18.2, NGN: 1550, KES: 129, GHS: 15.5, EGP: 48, MAD: 9.9,
  TZS: 2700, UGX: 3750, ETB: 125, XOF: 605, XAF: 605,
};

let cache: { at: number; rates: Record<string, number>; live: boolean } | null = null;

export async function GET() {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    try {
      const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`fx upstream ${res.status}`);
      const data = (await res.json()) as { rates: Record<string, number> };
      cache = { at: Date.now(), rates: { ...FALLBACK, ...data.rates }, live: true };
    } catch {
      cache = { at: Date.now(), rates: FALLBACK, live: false };
    }
  }
  return NextResponse.json(
    { base: "USD", live: cache.live, rates: cache.rates },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}

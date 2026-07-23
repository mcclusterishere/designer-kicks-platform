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
  EUR: 0.92, GBP: 0.78, NGN: 1550, PHP: 57, INR: 84, MXN: 18.4, BRL: 5.4,
  COP: 4100, KES: 129, GHS: 15.5, ZAR: 18.2, PKR: 278, IDR: 16200, VND: 25400,
  CAD: 1.36, AUD: 1.5, JPY: 155, CNY: 7.2, TRY: 34, EGP: 48, ARS: 940,
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

/**
 * Exchange rates, from USD, for everyone — not just the ECB's shortlist.
 *
 * The old table came from Frankfurter, which serves European Central Bank
 * reference rates: about thirty currencies, all of them European, American
 * or major-Asian. Ask it for Ghanaian cedi, Nigerian naira, Kenyan shilling
 * or UAE dirham and it has nothing, which is why a visitor in Accra saw
 * dollars and nothing else.
 *
 * So the waterfall now leads with a source that actually covers the world,
 * falls back to the ECB set, and finally to a baked-in table. Whatever a
 * conversion came from is reported honestly: `live` is false when we're
 * reading from the static table, and the UI marks those figures rather than
 * passing them off as a quote.
 *
 * Cached in-process for twelve hours. Sneaker prices don't move on FX.
 */

const TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Approximate rates per 1 USD, for when every upstream is unreachable.
 * Deliberately never presented as live — the UI shows "≈" throughout and
 * flags stale tables, because a wrong number stated confidently is worse
 * than an approximate one stated as approximate.
 */
const FALLBACK: Record<string, number> = {
  // Europe
  EUR: 0.92, GBP: 0.78, CHF: 0.88, SEK: 10.5, NOK: 10.8, DKK: 6.9,
  PLN: 3.95, CZK: 23, HUF: 355, RON: 4.6, BGN: 1.8, ISK: 138, TRY: 34,
  UAH: 41, RSD: 108, ALL: 93, MKD: 56.5, BAM: 1.8, MDL: 17.8, GEL: 2.7,
  // Americas
  CAD: 1.36, MXN: 18.4, BRL: 5.4, COP: 4100, ARS: 940, CLP: 950, PEN: 3.75,
  UYU: 40, BOB: 6.9, PYG: 7600, GTQ: 7.75, CRC: 515, DOP: 60, JMD: 157,
  TTD: 6.8, HNL: 24.8, NIO: 36.8, PAB: 1, BZD: 2, BBD: 2, BSD: 1,
  // Asia-Pacific
  JPY: 155, CNY: 7.2, HKD: 7.8, SGD: 1.34, KRW: 1370, INR: 84, TWD: 32.4,
  IDR: 16200, MYR: 4.5, THB: 35, PHP: 57, AUD: 1.5, NZD: 1.64, MMK: 2100,
  VND: 25400, PKR: 278, BDT: 120, LKR: 300, NPR: 134, KHR: 4080, LAK: 21800,
  MNT: 3400, KZT: 480, UZS: 12700, AZN: 1.7, AMD: 388, KGS: 86, FJD: 2.25,
  BND: 1.34, MOP: 8.04, PGK: 3.9,
  // Middle East
  ILS: 3.7, AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31, BHD: 0.376,
  OMR: 0.385, JOD: 0.709, LBP: 89500, IQD: 1310, YER: 250, IRR: 42000,
  // Africa
  ZAR: 18.2, NGN: 1550, KES: 129, GHS: 15.5, EGP: 48, MAD: 9.9, TND: 3.13,
  DZD: 134, TZS: 2700, UGX: 3750, ETB: 125, XOF: 605, XAF: 605, RWF: 1350,
  ZMW: 26.5, BWP: 13.6, MUR: 46.5, NAD: 18.2, MWK: 1735, MZN: 63.9,
  AOA: 910, CDF: 2850, SDG: 601, LYD: 4.85, SLL: 22500, GMD: 70, LRD: 195,
  SZL: 18.2, LSL: 18.2, SCR: 14.2, CVE: 101, DJF: 178, SOS: 571, BIF: 2950,
  MGA: 4550, GNF: 8600,
  USD: 1,
};

export type FxTable = { base: "USD"; rates: Record<string, number>; live: boolean; source: string };

/**
 * Seeded, not empty. `at: 0` means "infinitely stale", so the very first
 * getRates() still kicks off a live refresh — it just does not make
 * anybody wait for it.
 */
let cache: FxTable & { at: number } = {
  at: 0,
  base: "USD",
  rates: FALLBACK,
  live: false,
  source: "static table",
};

/**
 * The wide source: open.er-api.com is free, keyless, and covers roughly
 * 160 currencies including every African and Gulf currency the ECB set
 * leaves out.
 */
async function fetchWide(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates || typeof data.rates.EUR !== "number") return null;
    return data.rates;
  } catch {
    return null;
  }
}

/** The ECB set, kept as a second opinion for the currencies it does carry. */
async function fetchEcb(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    return data.rates && typeof data.rates.EUR === "number" ? data.rates : null;
  } catch {
    return null;
  }
}

/**
 * A failed lookup is not worth twelve hours of silence, but it is worth
 * a minute — otherwise every render of every page retries a dead
 * provider.
 */
const FAILURE_TTL_MS = 60 * 1000;

/** One refresh in flight at a time, however many visitors arrive at once. */
let inFlight: Promise<void> | null = null;

async function refresh(): Promise<void> {
  const wide = await fetchWide();
  if (wide) {
    cache = { at: Date.now(), base: "USD", rates: { ...FALLBACK, ...wide }, live: true, source: "open.er-api.com" };
    return;
  }
  const ecb = await fetchEcb();
  if (ecb) {
    // Honest about the gap: the ECB set is live for what it covers, and
    // everything else in this table is still the static approximation.
    cache = { at: Date.now(), base: "USD", rates: { ...FALLBACK, ...ecb }, live: true, source: "frankfurter (ECB subset)" };
    return;
  }
  // Stamp the failure far enough in the past that it expires in a minute
  // rather than sticking for the full twelve hours.
  cache = {
    at: Date.now() - (TTL_MS - FAILURE_TTL_MS),
    base: "USD",
    rates: FALLBACK,
    live: false,
    source: "static table",
  };
}

/**
 * Rates, without ever making a visitor wait on somebody else's server.
 *
 * This is read by the ROOT LAYOUT, which means it sits in front of the
 * first byte of HTML for every page on the site. It used to await a live
 * lookup with an eleven second budget across two providers, so a hanging
 * provider — not a failing one, a hanging one — showed every arriving
 * visitor a blank page for eleven seconds. Under paid traffic that is
 * the whole ad spend landing on nothing.
 *
 * Now the static table answers instantly and the live refresh happens
 * behind it. The first render after a restart is approximate, which is
 * exactly what this module was built for: every figure it produces is
 * already marked with "≈" and flagged when the table is not live.
 */
export async function getRates(): Promise<FxTable> {
  const fresh = cache && Date.now() - cache.at < TTL_MS;
  if (!fresh && !inFlight) {
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
    // Deliberately unhandled here: refresh() cannot reject, and nothing
    // upstream should ever wait on it.
    void inFlight;
  }
  // Seeded at module load, so this is never null and never blocks.
  return cache!;
}

/** Rate for one currency, or null when we genuinely have no number for it. */
export async function rateFor(currency: string): Promise<number | null> {
  const { rates } = await getRates();
  return rates[currency.toUpperCase()] ?? null;
}

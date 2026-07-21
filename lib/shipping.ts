/**
 * Shipping rails — deliberately ahead of payment rails. Sales settle
 * off-platform for now, but the moment a sale goes PENDING the seller
 * needs a real number for getting the box across the country, and when
 * checkout eventually opens this same layer prices shipping at order
 * time.
 *
 * Driver: EasyPost (rates via a throwaway shipment quote). Dormant
 * until EASYPOST_API_KEY is set — same pattern as Gemini/KicksDB/Meta:
 * code ships now, the key flips it on, and callers get a clean
 * "not configured" instead of an exception. SHIPPING_API_URL overrides
 * the host for tests.
 */

const SHIPPING_API = process.env.SHIPPING_API_URL || "https://api.easypost.com/v2";

// A shoebox, basically: 14×10×6in, 3lb. Fine default for sneakers and
// most apparel; callers can override for heavier pieces.
const DEFAULT_PARCEL = { length: 14, width: 10, height: 6, weight: 48 };

export type ShippingRate = {
  carrier: string;
  service: string;
  rateUsd: number;
  days: number | null;
};

export type ShippingQuoteResult =
  | { ok: true; rates: ShippingRate[] }
  | { ok: false; detail: string };

export function shippingConfigured(): boolean {
  return Boolean(process.env.EASYPOST_API_KEY);
}

export async function getShippingRates(opts: {
  fromZip: string;
  toZip: string;
  weightOz?: number;
}): Promise<ShippingQuoteResult> {
  if (!shippingConfigured()) {
    return { ok: false, detail: "Shipping not connected — set EASYPOST_API_KEY to quote live rates." };
  }
  const zipOk = /^\d{5}(-\d{4})?$/;
  if (!zipOk.test(opts.fromZip) || !zipOk.test(opts.toZip)) {
    return { ok: false, detail: "Enter both ZIP codes (5 digits)." };
  }

  try {
    const res = await fetch(`${SHIPPING_API}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${process.env.EASYPOST_API_KEY}:`).toString("base64")}`,
      },
      body: JSON.stringify({
        shipment: {
          from_address: { zip: opts.fromZip, country: "US" },
          to_address: { zip: opts.toZip, country: "US" },
          parcel: { ...DEFAULT_PARCEL, weight: opts.weightOz ?? DEFAULT_PARCEL.weight },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      rates?: { carrier: string; service: string; rate: string; delivery_days: number | null }[];
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      return { ok: false, detail: json.error?.message || `Shipping API ${res.status}` };
    }
    const rates = (json.rates ?? [])
      .map((r) => ({
        carrier: r.carrier,
        service: r.service,
        rateUsd: Number(r.rate),
        days: r.delivery_days ?? null,
      }))
      .filter((r) => Number.isFinite(r.rateUsd))
      .sort((a, b) => a.rateUsd - b.rateUsd);
    if (rates.length === 0) return { ok: false, detail: "No rates came back for that lane." };
    return { ok: true, rates };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Shipping quote failed" };
  }
}

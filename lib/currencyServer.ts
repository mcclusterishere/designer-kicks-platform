import { cookies, headers } from "next/headers";
import { getRates } from "./fx";
import { COOKIE, TZ_COOKIE, COUNTRY_CURRENCY, countryFromZone, type Money } from "./currency";

/**
 * Server-side currency resolution.
 *
 * Split out from lib/currency because this half reads cookies and request
 * headers, and the formatting half is shared with client components — a
 * next/headers import anywhere in that chain fails the client build.
 */

/**
 * Resolve the viewer's money, server-side, so the first paint is already
 * correct — no flash of dollars, no layout shift.
 */
export async function resolveMoney(): Promise<Money> {
  const jar = await cookies();
  const chosen = jar.get(COOKIE)?.value?.toUpperCase();
  const { rates, live } = await getRates();

  if (chosen && rates[chosen]) {
    return { currency: chosen, rate: rates[chosen], explicit: true, live: chosen === "USD" ? true : live };
  }

  // Time zone beats language: it says where the device is, not what it speaks.
  const country =
    countryFromZone(jar.get(TZ_COOKIE)?.value) ?? (await countryFromAcceptLanguage());
  const currency = country ? COUNTRY_CURRENCY[country] : undefined;

  if (currency && rates[currency]) {
    return { currency, rate: rates[currency], explicit: false, live: currency === "USD" ? true : live };
  }
  return { currency: "USD", rate: 1, explicit: false, live: true };
}

/** Last resort: a region subtag in Accept-Language, e.g. en-GH. */
async function countryFromAcceptLanguage(): Promise<string | null> {
  try {
    const raw = (await headers()).get("accept-language");
    if (!raw) return null;
    for (const part of raw.split(",")) {
      const tag = part.split(";")[0].trim();
      const m = /^[a-z]{2,3}-([A-Z]{2})$/.exec(tag);
      if (m && COUNTRY_CURRENCY[m[1]]) return m[1];
    }
  } catch {}
  return null;
}


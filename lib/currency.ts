
/**
 * Which money the person reading the page actually uses.
 *
 * The previous attempt guessed from `navigator.language`, and that is the
 * bug: language is not location. A phone in Accra almost always reports
 * en-US or en-GB, so the region came back as US — which wasn't even in the
 * lookup table — and the conversion silently rendered nothing. Someone in
 * Ghana saw dollars, exactly as reported.
 *
 * So there are three signals now, in descending order of how much they can
 * be trusted:
 *
 *   1. An explicit choice, stored in a cookie. Always wins. A picker is the
 *      only thing that's ever completely right, so one is on every page.
 *   2. The device's IANA time zone (Africa/Accra → GH). This tracks where
 *      the hardware actually is rather than what language it speaks, which
 *      makes it far better evidence than locale for exactly the case that
 *      was broken.
 *   3. Accept-Language's region subtag, if it carries one — en-GH is rare
 *      but unambiguous when present.
 *
 * Falling through all three lands on USD, which is also the currency every
 * price is stored in.
 */

export const COOKIE = "thc-currency";
export const TZ_COOKIE = "thc-tz";

/** Country → currency. Includes US, whose absence broke detection before. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD", PR: "USD", GU: "USD", VI: "USD", EC: "USD", SV: "USD", PA: "USD",
  ZW: "USD", TL: "USD",
  // Eurozone
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", PT: "EUR", IE: "EUR",
  BE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", SK: "EUR", SI: "EUR", LT: "EUR",
  LV: "EUR", EE: "EUR", LU: "EUR", CY: "EUR", MT: "EUR", HR: "EUR", MC: "EUR",
  AD: "EUR", SM: "EUR", VA: "EUR", ME: "EUR", XK: "EUR",
  // Rest of Europe
  GB: "GBP", CH: "CHF", LI: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
  CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", IS: "ISK", TR: "TRY", UA: "UAH",
  RS: "RSD", AL: "ALL", MK: "MKD", BA: "BAM", MD: "MDL", GE: "GEL",
  // Americas
  CA: "CAD", MX: "MXN", BR: "BRL", CO: "COP", AR: "ARS", CL: "CLP", PE: "PEN",
  UY: "UYU", BO: "BOB", PY: "PYG", GT: "GTQ", CR: "CRC", DO: "DOP", JM: "JMD",
  TT: "TTD", HN: "HNL", NI: "NIO", BZ: "BZD", BB: "BBD", BS: "BSD",
  // Asia-Pacific
  JP: "JPY", CN: "CNY", HK: "HKD", SG: "SGD", KR: "KRW", IN: "INR", TW: "TWD",
  ID: "IDR", MY: "MYR", TH: "THB", PH: "PHP", AU: "AUD", NZ: "NZD", MM: "MMK",
  VN: "VND", PK: "PKR", BD: "BDT", LK: "LKR", NP: "NPR", KH: "KHR", LA: "LAK",
  MN: "MNT", KZ: "KZT", UZ: "UZS", AZ: "AZN", AM: "AMD", KG: "KGS", FJ: "FJD",
  BN: "BND", MO: "MOP", PG: "PGK",
  // Middle East
  IL: "ILS", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR",
  JO: "JOD", LB: "LBP", IQ: "IQD", YE: "YER", IR: "IRR",
  // Africa
  ZA: "ZAR", NG: "NGN", KE: "KES", GH: "GHS", EG: "EGP", MA: "MAD", TN: "TND",
  DZ: "DZD", TZ: "TZS", UG: "UGX", ET: "ETB", RW: "RWF", ZM: "ZMW", BW: "BWP",
  MU: "MUR", NA: "NAD", MW: "MWK", MZ: "MZN", AO: "AOA", CD: "CDF", SD: "SDG",
  LY: "LYD", SL: "SLL", GM: "GMD", LR: "LRD", SZ: "SZL", LS: "LSL", SC: "SCR",
  CV: "CVE", DJ: "DJF", SO: "SOS", BI: "BIF", MG: "MGA", GN: "GNF",
  CI: "XOF", SN: "XOF", ML: "XOF", BF: "XOF", NE: "XOF", TG: "XOF", BJ: "XOF",
  GW: "XOF", CM: "XAF", GA: "XAF", CG: "XAF", TD: "XAF", CF: "XAF", GQ: "XAF",
};

/**
 * The currencies we're willing to show, for the picker. Everything else
 * still resolves through the map above — this is just the shortlist a human
 * scrolls, led by the markets we actually see traffic from.
 */
export const PICKER: { code: string; label: string }[] = [
  { code: "USD", label: "US Dollar" },
  { code: "GHS", label: "Ghanaian Cedi" },
  { code: "NGN", label: "Nigerian Naira" },
  { code: "KES", label: "Kenyan Shilling" },
  { code: "ZAR", label: "South African Rand" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "INR", label: "Indian Rupee" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "BRL", label: "Brazilian Real" },
  { code: "MXN", label: "Mexican Peso" },
  { code: "AED", label: "UAE Dirham" },
  { code: "EGP", label: "Egyptian Pound" },
  { code: "PHP", label: "Philippine Peso" },
];

/**
 * IANA zone → country, for the zones that disambiguate a currency. Only the
 * prefix and city matter, so this stays a lookup rather than a full tz
 * database: "Africa/Accra" is Ghana and nothing else.
 */
const ZONE_COUNTRY: Record<string, string> = {
  "Africa/Accra": "GH", "Africa/Lagos": "NG", "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA", "Africa/Cairo": "EG", "Africa/Casablanca": "MA",
  "Africa/Tunis": "TN", "Africa/Algiers": "DZ", "Africa/Dar_es_Salaam": "TZ",
  "Africa/Kampala": "UG", "Africa/Addis_Ababa": "ET", "Africa/Kigali": "RW",
  "Africa/Lusaka": "ZM", "Africa/Gaborone": "BW", "Indian/Mauritius": "MU",
  "Africa/Windhoek": "NA", "Africa/Blantyre": "MW", "Africa/Maputo": "MZ",
  "Africa/Luanda": "AO", "Africa/Kinshasa": "CD", "Africa/Khartoum": "SD",
  "Africa/Tripoli": "LY", "Africa/Freetown": "SL", "Africa/Banjul": "GM",
  "Africa/Monrovia": "LR", "Africa/Mbabane": "SZ", "Africa/Maseru": "LS",
  "Africa/Abidjan": "CI", "Africa/Dakar": "SN", "Africa/Bamako": "ML",
  "Africa/Ouagadougou": "BF", "Africa/Niamey": "NE", "Africa/Lome": "TG",
  "Africa/Porto-Novo": "BJ", "Africa/Douala": "CM", "Africa/Libreville": "GA",
  "Africa/Brazzaville": "CG", "Africa/Ndjamena": "TD", "Africa/Bangui": "CF",
  "Africa/Harare": "ZW", "Africa/Mogadishu": "SO", "Africa/Bujumbura": "BI",
  "Indian/Antananarivo": "MG", "Africa/Conakry": "GN", "Africa/Djibouti": "DJ",
  "Atlantic/Cape_Verde": "CV", "Indian/Mahe": "SC",
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR",
  "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL", "Europe/Lisbon": "PT", "Europe/Brussels": "BE",
  "Europe/Vienna": "AT", "Europe/Helsinki": "FI", "Europe/Athens": "GR",
  "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK",
  "Europe/Zurich": "CH", "Europe/Warsaw": "PL", "Europe/Prague": "CZ",
  "Europe/Budapest": "HU", "Europe/Bucharest": "RO", "Europe/Sofia": "BG",
  "Atlantic/Reykjavik": "IS", "Europe/Istanbul": "TR", "Europe/Kyiv": "UA",
  "Europe/Kiev": "UA", "Europe/Belgrade": "RS", "Europe/Moscow": "RU",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
  "America/Winnipeg": "CA", "America/Halifax": "CA",
  "America/Mexico_City": "MX", "America/Monterrey": "MX", "America/Tijuana": "MX",
  "America/Sao_Paulo": "BR", "America/Bahia": "BR", "America/Fortaleza": "BR",
  "America/Bogota": "CO", "America/Argentina/Buenos_Aires": "AR",
  "America/Santiago": "CL", "America/Lima": "PE", "America/Montevideo": "UY",
  "America/La_Paz": "BO", "America/Asuncion": "PY", "America/Guatemala": "GT",
  "America/Costa_Rica": "CR", "America/Santo_Domingo": "DO", "America/Jamaica": "JM",
  "America/Port_of_Spain": "TT", "America/Tegucigalpa": "HN", "America/Managua": "NI",
  "Asia/Tokyo": "JP", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK",
  "Asia/Singapore": "SG", "Asia/Seoul": "KR", "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN", "Asia/Taipei": "TW", "Asia/Jakarta": "ID",
  "Asia/Kuala_Lumpur": "MY", "Asia/Bangkok": "TH", "Asia/Manila": "PH",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Perth": "AU",
  "Australia/Brisbane": "AU", "Pacific/Auckland": "NZ", "Asia/Yangon": "MM",
  "Asia/Ho_Chi_Minh": "VN", "Asia/Saigon": "VN", "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD", "Asia/Colombo": "LK", "Asia/Kathmandu": "NP",
  "Asia/Phnom_Penh": "KH", "Asia/Vientiane": "LA", "Asia/Ulaanbaatar": "MN",
  "Asia/Almaty": "KZ", "Asia/Tashkent": "UZ", "Asia/Baku": "AZ",
  "Asia/Yerevan": "AM", "Asia/Bishkek": "KG", "Pacific/Fiji": "FJ",
  "Asia/Brunei": "BN", "Asia/Macau": "MO", "Pacific/Port_Moresby": "PG",
  "Asia/Jerusalem": "IL", "Asia/Tel_Aviv": "IL", "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA", "Asia/Qatar": "QA", "Asia/Kuwait": "KW",
  "Asia/Bahrain": "BH", "Asia/Muscat": "OM", "Asia/Amman": "JO",
  "Asia/Beirut": "LB", "Asia/Baghdad": "IQ", "Asia/Tehran": "IR",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US",
  "Pacific/Honolulu": "US", "America/Detroit": "US",
};

export function countryFromZone(tz: string | undefined | null): string | null {
  if (!tz) return null;
  const exact = ZONE_COUNTRY[tz];
  if (exact) return exact;
  // Unlisted zone in a region we do know: fall back on the continent's
  // most common answer only where that's unambiguous. Africa/* is not, so
  // it returns null rather than guessing somebody into the wrong money.
  return null;
}

export type Money = {
  /** ISO code being displayed. */
  currency: string;
  /** Multiply a USD amount by this. 1 when displaying dollars. */
  rate: number;
  /** True when the viewer picked it themselves. */
  explicit: boolean;
  /** False when the rate came from the static table, so the UI can mark it. */
  live: boolean;
};

/**
 * Format a USD-cent amount in the viewer's currency.
 *
 * Converted figures are always prefixed "≈" — the underlying price is a
 * dollar price and this is a conversion of it, not a quote in that
 * currency, and pretending otherwise would be a lie about what someone
 * will actually be charged. Dollars themselves get no tilde.
 */
export function formatMoney(cents: number, money: Money): string {
  const usd = cents / 100;
  if (money.currency === "USD") {
    return `$${Math.round(usd).toLocaleString("en-US")}`;
  }
  const amount = usd * money.rate;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: money.currency,
    notation: amount >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: amount < 10 ? 2 : 0,
  }).format(amount);
  return `≈ ${formatted}${money.live ? "" : "*"}`;
}

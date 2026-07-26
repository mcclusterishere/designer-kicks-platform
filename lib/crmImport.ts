/**
 * Importing from whatever they were using before.
 *
 * The single reason people don't leave a CRM is that moving costs them
 * their history. So this is built to accept the actual export files the
 * major tools produce, name the tool it recognises, and — the part
 * almost nobody does — keep the columns it has no home for instead of
 * dropping them on the floor.
 *
 * A HubSpot export has fifty columns. A generic importer maps four and
 * silently discards the rest, which is how somebody loses six years of
 * lifecycle stages and deal notes and only finds out months later. Here
 * anything unrecognised lands in customFields, stays attached to the
 * contact, and is visible on their page. Nothing that was in the file
 * leaves without being counted.
 */

/** The canonical fields we understand natively. */
export type CoreField =
  | "name"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "social"
  | "city"
  | "notes"
  | "company"
  | "shoeSize"
  | "tags"
  | "createdAt"
  | "totalSpent";

/**
 * Header aliases, normalised on both sides before comparison.
 *
 * Drawn from the real export formats: HubSpot writes "First Name" and
 * "Contact owner"; Salesforce writes "MailingCity"; Pipedrive writes
 * "Person - Name"; Mailchimp writes "Email Address" and "FNAME";
 * Shopify writes "Accepts Marketing"; Google Contacts writes
 * "E-mail 1 - Value"; Outlook writes "E-mail Address".
 */
const ALIASES: Record<CoreField, string[]> = {
  name: [
    "name", "full name", "fullname", "display name", "contact name", "customer name",
    "client", "client name", "person name", "person   name", "account name", "title",
    "customer", "buyer", "buyer name",
  ],
  firstName: ["first name", "firstname", "given name", "first", "fname", "given"],
  lastName: ["last name", "lastname", "family name", "surname", "last", "lname"],
  email: [
    "email", "e mail", "email address", "e mail address", "primary email", "email1",
    "e mail 1   value", "work email", "personal email", "contact email", "customer email",
    "buyer email", "email (primary)", "emails",
  ],
  phone: [
    "phone", "phone number", "mobile", "mobile phone", "cell", "cell phone", "telephone",
    "phone 1   value", "primary phone", "work phone", "home phone", "contact phone",
    "mobile number", "phone (primary)",
  ],
  social: [
    "instagram", "ig", "instagram handle", "social", "handle", "username", "twitter",
    "x", "tiktok", "social handle", "instagram username", "website",
  ],
  city: [
    "city", "town", "location", "mailingcity", "mailing city", "address city",
    "city/town", "billing city", "shipping city", "billing address city",
  ],
  notes: [
    "notes", "note", "comment", "comments", "description", "about", "bio", "remarks",
    "internal notes",
  ],
  company: ["company", "company name", "organisation", "organization", "account", "business", "brand"],
  shoeSize: ["size", "shoe size", "us size", "sneaker size", "shoesize", "size (us)"],
  tags: ["tags", "tag", "labels", "label", "groups", "group", "segment", "lists", "list"],
  createdAt: [
    "created at", "create date", "created", "date created", "signup date",
    "customer since", "first order date", "date added",
  ],
  /**
   * Deliberately EMPTY, and that is the decision, not an oversight.
   *
   * A "Total Spent" column in a Shopify export is what somebody spent on
   * Shopify. "Deal Amount" in HubSpot is one deal, not a lifetime. This
   * platform computes totalSpentCents from confirmed sales it actually
   * witnessed, and letting a foreign number write into that field
   * produces a blended figure that means nothing and can't be audited —
   * on the same screen an artist is being told is their real revenue.
   *
   * So money columns fall through to customFields: preserved, visible on
   * the contact, labelled with the tool they came from, and never mixed
   * into a number this platform vouches for.
   */
  totalSpent: [],
};

/** Column names worth keeping even though we have no field for them. */
const NOISE = new Set([
  "id", "record id", "contact id", "customer id", "vid", "uuid", "row",
  "unsubscribed", "unsubscribe reason", "cleaned", "opt in", "confirm time",
  "member rating", "latitude", "longitude", "gmtoff", "timezone", "cc", "region",
  "last changed", "leid", "euid", "notes_1",
]);

export function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/[^a-z0-9 /()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Which tool produced this file, from fingerprint columns.
 *
 * Only used to tell the artist what we recognised — it never changes how
 * the file is parsed, so a wrong guess is cosmetic rather than
 * destructive.
 */
export function detectSource(headers: string[]): string | null {
  const h = new Set(headers.map(normHeader));
  const has = (...names: string[]) => names.every((n) => h.has(normHeader(n)));

  if (has("Record ID", "Contact owner") || h.has("lifecycle stage")) return "HubSpot";
  if (has("MailingCity") || h.has("account name 18")) return "Salesforce";
  if ([...h].some((x) => x.startsWith("person "))) return "Pipedrive";
  if (has("Email Address", "MEMBER_RATING".toLowerCase()) || h.has("member rating")) return "Mailchimp";
  if (has("Accepts Marketing") || has("Total Spent", "Total Orders")) return "Shopify";
  if (has("E mail 1   Value") || has("Given Name", "Family Name")) return "Google Contacts";
  if (has("E mail Address") && h.has("first name")) return "Outlook";
  if (h.has("klaviyo id") || has("Klaviyo ID")) return "Klaviyo";
  if (h.has("customer reference id") || has("Square Customer ID")) return "Square";
  if (has("Buyer Name") && h.has("ship name")) return "Etsy";
  return null;
}

export type FieldMap = {
  /** Column index for each core field we found. */
  index: Partial<Record<CoreField, number>>;
  /** Columns kept as custom fields: header → column index. */
  custom: { header: string; at: number }[];
  /** Columns deliberately discarded as exporter plumbing. */
  ignored: string[];
  source: string | null;
};

/** Work out what each column is, keeping what we can't place. */
export function mapHeaders(rawHeaders: string[]): FieldMap {
  const headers = rawHeaders.map(normHeader);
  const index: Partial<Record<CoreField, number>> = {};
  const claimed = new Set<number>();

  for (const [field, aliases] of Object.entries(ALIASES) as [CoreField, string[]][]) {
    const wanted = aliases.map(normHeader);
    const at = headers.findIndex((h, i) => !claimed.has(i) && wanted.includes(h));
    if (at >= 0) {
      index[field] = at;
      claimed.add(at);
    }
  }

  const custom: { header: string; at: number }[] = [];
  const ignored: string[] = [];
  rawHeaders.forEach((raw, i) => {
    if (claimed.has(i)) return;
    const label = raw.trim();
    if (!label) return;
    if (NOISE.has(normHeader(label))) {
      ignored.push(label);
      return;
    }
    custom.push({ header: label, at: i });
  });

  return { index, custom, ignored, source: detectSource(rawHeaders) };
}

/** Split a tag cell the way every exporter writes it: commas or semicolons. */
export function parseTags(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 40)
    .slice(0, 12);
}

/** "$1,240.50" → 124050. Returns null for anything that isn't money. */
export function parseMoneyCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** A date an exporter wrote, or null. Never guesses a wrong year. */
export function parseDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  // Anything outside a sane window is a parse accident, not a date.
  const year = d.getFullYear();
  if (year < 1990 || year > 2100) return null;
  return d;
}

/** US shoe sizes as people actually write them. */
export function parseShoeSize(raw: string): string | null {
  const s = raw.trim().replace(/^(us|size)\s*/i, "");
  if (!s) return null;
  const m = s.match(/^(\d{1,2}(?:\.\d)?)\s*(w|m|womens?|mens?)?$/i);
  if (!m) return s.slice(0, 12);
  const num = m[1];
  const w = m[2]?.toLowerCase().startsWith("w");
  return w ? `W${num}` : num;
}

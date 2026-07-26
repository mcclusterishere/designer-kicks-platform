import { prisma } from "./db";
import {
  mapHeaders,
  parseTags,
  parseMoneyCents,
  parseShoeSize,
} from "./crmImport";

/**
 * Contact import — getting an artist's existing customer list in.
 *
 * Nobody starts from zero. A maker who's been selling for three years
 * has that history in an iPhone contacts export, a Shopify CSV, a Google
 * Contacts dump, or a spreadsheet they typed themselves. An empty CRM is
 * one nobody logs into twice, so import is the feature that decides
 * whether any of this gets used at all.
 *
 * Two rules drive everything below.
 *
 * First, re-importing the same file must not duplicate the list.
 * People export twice, add ten rows, and import again — that's normal
 * behaviour, not misuse. Email is the natural key, so rows with one
 * upsert and rows without one are matched on name.
 *
 * Second, an imported contact has NOT consented to marketing. Somebody's
 * phone book is not a mailing list. Every imported row lands with
 * emailOptIn false regardless of what the file claims, because the
 * alternative is a maker importing 800 phone contacts and blasting them
 * from our sending domain — which is a CAN-SPAM problem for them and a
 * dead sending reputation for everyone else on the platform.
 */

export type ParsedContact = {
  name: string;
  email: string | null;
  phone: string | null;
  social: string | null;
  city: string | null;
  notes: string | null;
  shoeSize: string | null;
  tags: string[];
  totalSpentCents: number | null;
  /** Columns the file had that we have no field for — kept, never dropped. */
  customFields: Record<string, string>;
};

export type ParseReport = {
  contacts: ParsedContact[];
  /** Which CRM we recognised, purely so we can say so. */
  source: string | null;
  /** Extra columns preserved onto each contact rather than discarded. */
  keptColumns: string[];
  /** Rows that couldn't be used, with the reason — shown, never silent. */
  skipped: { line: number; reason: string }[];
  /** Header names we didn't recognise, so the artist can see what was ignored. */
  unmappedColumns: string[];
};

/**
 * A CSV parser that survives real exports.
 *
 * Quoted fields containing commas, escaped double quotes, CRLF line
 * endings from Windows and Excel, and a UTF-8 BOM — Google Contacts and
 * Shopify both emit at least two of those. A naive split(",") mangles
 * every address with a comma in it, which in a contacts file is most of
 * them.
 */
export function parseCsv(text: string): string[][] {
  return parseCsvRows(text).map((r) => r.cells);
}

/**
 * The same parse, carrying each row's line number in the ORIGINAL file.
 *
 * Blank rows get dropped, so a row's index in the result stops matching
 * its line in the file the moment one appears. Reporting "row 47" when
 * the artist's spreadsheet says 51 sends them hunting for a problem
 * that isn't where we said it was, which is worse than not reporting it.
 */
export function parseCsvRows(text: string): { cells: string[]; line: number }[] {
  const rows: { cells: string[]; line: number }[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;

  // Strip the BOM Excel loves to prepend; it otherwise becomes part of
  // the first header name and breaks column matching invisibly.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      // Treat CRLF as one break, not two.
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // Skip rows that are entirely empty — trailing newlines are normal.
      if (row.some((f) => f.trim() !== "")) rows.push({ cells: row, line });
      row = [];
      line++;
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push({ cells: row, line });
  return rows;
}

/** Loose enough to catch typos in an export, strict enough not to send mail into the void. */
export function looksLikeEmail(s: string): boolean {
  return /^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/.test(s.trim());
}

/** Digits only, so "(555) 010-1234" and "555.010.1234" are one person. */
export function normalizePhone(s: string): string | null {
  const digits = s.replace(/\D/g, "");
  if (digits.length < 7) return null; // not a real number
  return digits;
}

/** "@name", "instagram.com/name/", "https://www.instagram.com/name" → "name" */
export function normalizeHandle(s: string): string | null {
  let v = s.trim();
  if (!v) return null;
  v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  v = v.replace(/\/+$/, "").replace(/^@/, "").split("?")[0];
  return v || null;
}

/**
 * Turn a CSV's text into contacts, reporting everything it couldn't use.
 *
 * Column mapping is delegated to lib/crmImport, which knows the header
 * names HubSpot, Salesforce, Pipedrive, Mailchimp, Shopify, Klaviyo,
 * Square, Etsy, Google and Outlook actually write. Columns it can't
 * place are kept as custom fields rather than dropped — losing six years
 * of somebody's notes on the way in is the reason people refuse to
 * migrate CRMs at all.
 */
export function parseContacts(text: string): ParseReport {
  const rows = parseCsvRows(text);
  const skipped: { line: number; reason: string }[] = [];
  const empty: ParseReport = {
    contacts: [], skipped, unmappedColumns: [], source: null, keptColumns: [],
  };
  if (rows.length === 0) return empty;

  const map = mapHeaders(rows[0].cells);
  const keptColumns = map.custom.map((c) => c.header);

  // A file with no recognisable name OR email column isn't a contacts
  // export — say so rather than importing a page of blanks.
  if (
    map.index.name === undefined &&
    map.index.firstName === undefined &&
    map.index.email === undefined
  ) {
    return {
      ...empty,
      source: map.source,
      keptColumns,
      unmappedColumns: keptColumns,
      skipped: [
        { line: 1, reason: "No name or email column found — check the file's header row." },
      ],
    };
  }

  const at = (row: string[], k: keyof typeof map.index): string => {
    const i = map.index[k];
    return i === undefined ? "" : (row[i] ?? "").trim();
  };

  const contacts: ParsedContact[] = [];
  const seen = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r].cells;
    const line = rows[r].line;

    const joined = [at(row, "firstName"), at(row, "lastName")].filter(Boolean).join(" ");
    const rawEmail = at(row, "email");
    const email = rawEmail && looksLikeEmail(rawEmail) ? rawEmail.trim().toLowerCase() : null;
    const name = at(row, "name") || joined || (email ? email.split("@")[0] : "");

    if (!name) {
      skipped.push({ line, reason: "No name and no email" });
      continue;
    }
    if (rawEmail && !email) {
      // Keep the person, drop the bad address — losing the whole row over
      // a typo'd email is worse than holding a contact we can't mail.
      skipped.push({ line, reason: `Dropped an unusable email: "${rawEmail.slice(0, 40)}"` });
    }

    const dedupeKey = email ?? `name:${name.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      skipped.push({ line, reason: `Duplicate of an earlier row (${name})` });
      continue;
    }
    seen.add(dedupeKey);

    // Everything the file had that we have no column for.
    const customFields: Record<string, string> = {};
    for (const c of map.custom) {
      const v = (row[c.at] ?? "").trim();
      if (v) customFields[c.header] = v.slice(0, 500);
    }
    // A company name has no first-class home yet, so it rides along
    // rather than vanishing.
    const company = at(row, "company");
    if (company) customFields["Company"] = company.slice(0, 200);

    contacts.push({
      name: name.slice(0, 120),
      email,
      phone: normalizePhone(at(row, "phone")),
      social: normalizeHandle(at(row, "social")),
      city: at(row, "city").slice(0, 80) || null,
      notes: at(row, "notes").slice(0, 500) || null,
      shoeSize: parseShoeSize(at(row, "shoeSize")),
      tags: parseTags(at(row, "tags")),
      totalSpentCents: parseMoneyCents(at(row, "totalSpent")),
      customFields,
    });
  }

  return { contacts, skipped, unmappedColumns: keptColumns, keptColumns, source: map.source };
}

export type ImportResult = {
  created: number;
  updated: number;
  skipped: { line: number; reason: string }[];
  unmappedColumns: string[];
  total: number;
};

/**
 * Write parsed contacts to an artist's list.
 *
 * Re-running the same file updates rather than duplicates. Fields only
 * fill in — an import never blanks something the artist typed by hand,
 * because the spreadsheet is not more trustworthy than they are.
 */
export async function importContacts(
  artistId: string,
  report: ParseReport
): Promise<ImportResult> {
  let created = 0;
  let updated = 0;

  for (const c of report.contacts) {
    // Contacts with an email use the unique key. Contacts without one
    // can't, so they're matched on name within this artist's list.
    const existing = c.email
      ? await prisma.contact.findUnique({
          where: { artistId_email: { artistId, email: c.email } },
          select: { id: true, tags: true, customFields: true },
        })
      : await prisma.contact.findFirst({
          where: { artistId, name: c.name, email: null },
          select: { id: true, tags: true, customFields: true },
        });

    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          // Only fill gaps. An import is a source of new information,
          // never an eraser for what's already known.
          phone: c.phone ?? undefined,
          social: c.social ?? undefined,
          city: c.city ?? undefined,
          notes: c.notes ?? undefined,
          shoeSize: c.shoeSize ?? undefined,
          // Tags merge rather than replace: a second import from a
          // different tool should add its labels, not wipe the first's.
          ...(c.tags.length > 0
            ? { tags: [...new Set([...(existing.tags ?? []), ...c.tags])] }
            : {}),
          ...(Object.keys(c.customFields).length > 0
            ? {
                customFields: {
                  ...((existing.customFields as Record<string, string>) ?? {}),
                  ...c.customFields,
                },
              }
            : {}),
        },
      });
      updated++;
    } else {
      await prisma.contact.create({
        data: {
          artistId,
          name: c.name,
          email: c.email,
          phone: c.phone,
          social: c.social,
          city: c.city,
          notes: c.notes,
          shoeSize: c.shoeSize,
          tags: c.tags,
          customFields: Object.keys(c.customFields).length > 0 ? c.customFields : undefined,
          importSource: report.source,
          source: "import",
          // Never true on import. Somebody's phone book has not opted in
          // to marketing, whatever the CSV says.
          emailOptIn: false,
        },
      });
      created++;
    }
  }

  return {
    created,
    updated,
    skipped: report.skipped,
    unmappedColumns: report.unmappedColumns,
    total: report.contacts.length,
  };
}

/**
 * Fold the artist's real sales history into their contact list.
 *
 * The buyers are already in the database — they're on Sale rows. This
 * turns them into contacts with genuine spend attached, which is what
 * makes the list worth opening on day one instead of after a year of
 * manual entry.
 */
export async function syncContactsFromSales(artistId: string): Promise<{ touched: number }> {
  const sales = await prisma.sale.findMany({
    where: { submission: { artistId }, status: "CONFIRMED" },
    select: { buyerEmail: true, buyerId: true, priceCents: true, soldAt: true },
    orderBy: { soldAt: "asc" },
  });

  const byEmail = new Map<
    string,
    { total: number; count: number; last: Date; userId: string | null }
  >();
  for (const s of sales) {
    const email = s.buyerEmail?.trim().toLowerCase();
    if (!email || !looksLikeEmail(email)) continue;
    const row = byEmail.get(email) ?? { total: 0, count: 0, last: s.soldAt, userId: null };
    row.total += s.priceCents;
    row.count += 1;
    if (s.soldAt > row.last) row.last = s.soldAt;
    row.userId = row.userId ?? s.buyerId;
    byEmail.set(email, row);
  }

  for (const [email, r] of byEmail) {
    // Stage is derived from what actually happened, never typed, so it
    // can't drift into wishful thinking.
    const stage = r.count > 1 ? "REPEAT" : "CUSTOMER";
    await prisma.contact.upsert({
      where: { artistId_email: { artistId, email } },
      create: {
        artistId,
        name: email.split("@")[0],
        email,
        source: "sale",
        stage,
        totalSpentCents: r.total,
        purchaseCount: r.count,
        lastContactAt: r.last,
        userId: r.userId,
        // A buyer gave us their address to complete a purchase. That is
        // not consent to a newsletter, so it still starts false.
        emailOptIn: false,
      },
      update: {
        stage,
        totalSpentCents: r.total,
        purchaseCount: r.count,
        lastContactAt: r.last,
        userId: r.userId ?? undefined,
        source: "sale",
      },
    });
  }

  return { touched: byEmail.size };
}

/**
 * Superseded by contactList() in lib/crm.ts, which adds search and
 * segments. Kept because the CSV export and the verify suite both read
 * it, and because it is the one query guaranteed to return the whole
 * book unfiltered.
 */
/** Days since a customer was last heard from, and who's overdue. */
const DAY = 24 * 60 * 60 * 1000;

export async function contactBook(artistId: string, limit = 500) {
  const rows = await prisma.contact.findMany({
    where: { artistId },
    orderBy: [{ totalSpentCents: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  const now = Date.now();
  return rows.map((c) => ({
    ...c,
    daysQuiet: c.lastContactAt ? Math.round((now - c.lastContactAt.getTime()) / DAY) : null,
  }));
}

export async function contactStats(artistId: string) {
  const [total, customers, repeat, spend] = await Promise.all([
    prisma.contact.count({ where: { artistId } }),
    prisma.contact.count({ where: { artistId, purchaseCount: { gt: 0 } } }),
    prisma.contact.count({ where: { artistId, purchaseCount: { gt: 1 } } }),
    prisma.contact.aggregate({ where: { artistId }, _sum: { totalSpentCents: true } }),
  ]);
  const lapsed = await prisma.contact.count({
    where: {
      artistId,
      purchaseCount: { gt: 0 },
      lastContactAt: { lt: new Date(Date.now() - 120 * DAY) },
    },
  });
  return {
    total,
    customers,
    repeat,
    lapsed,
    totalSpentCents: spend._sum.totalSpentCents ?? 0,
    repeatPct: customers > 0 ? Math.round((repeat / customers) * 100) : 0,
  };
}

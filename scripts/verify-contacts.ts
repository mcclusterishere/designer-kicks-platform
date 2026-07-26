/**
 * Contact import, against the files people actually have.
 *
 * Import is the feature that decides whether the CRM gets used at all —
 * an empty one is a page nobody opens twice. And it's the feature most
 * likely to quietly mangle data: a naive split(",") destroys every
 * address containing a comma, which in a contacts export is most of them.
 *
 * So the fixtures here are real exporter shapes: Google Contacts with its
 * "E-mail 1 - Value" headers and split given/family names, an Excel file
 * with a BOM and CRLF endings, quoted fields with commas and escaped
 * quotes inside them, and the same file imported twice.
 *
 * Run: npm run verify:contacts   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import {
  parseCsv,
  parseContacts,
  importContacts,
  syncContactsFromSales,
  contactStats,
  looksLikeEmail,
  normalizePhone,
  normalizeHandle,
} from "../lib/contacts";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const TAG = "verify-contacts";
let artistId = "";
let userId = "";
const madeSubs: string[] = [];

async function main() {
  // ---- The parser, on shapes real exports actually have -------------

  // Quoted commas. The classic failure: "Doe, John" becomes two fields.
  {
    const rows = parseCsv('name,city\n"Doe, John","Brooklyn, NY"\n');
    check("a quoted comma stays one field", rows[1][0] === "Doe, John", JSON.stringify(rows[1]));
    check("a second quoted comma survives too", rows[1][1] === "Brooklyn, NY", JSON.stringify(rows[1]));
  }

  // Escaped quotes, Windows line endings, and Excel's BOM.
  {
    const rows = parseCsv('﻿name,notes\r\n"Kai ""Smoke"" Reed",wants a 4\r\n');
    check("a BOM doesn't corrupt the first header", rows[0][0] === "name", JSON.stringify(rows[0][0]));
    check('escaped quotes become one quote', rows[1][0] === 'Kai "Smoke" Reed', rows[1][0]);
    check("CRLF is one row break, not two", rows.length === 2, `${rows.length} rows`);
  }

  check("trailing newlines don't make an empty row", parseCsv("a,b\n1,2\n\n\n").length === 2);

  // A Google Contacts export, headers and all.
  {
    const csv = [
      "Given Name,Family Name,E-mail 1 - Value,Phone 1 - Value,Notes",
      "Marcus,Webb,MARCUS@example.com,(555) 010-1234,repeat buyer",
      "Tia,Nguyen,tia@example.com,555.010.9999,",
    ].join("\n");
    const r = parseContacts(csv);
    check("Google Contacts headers are understood", r.contacts.length === 2, `${r.contacts.length}`);
    check("first + family name are joined", r.contacts[0].name === "Marcus Webb", r.contacts[0].name);
    check("emails are lowercased", r.contacts[0].email === "marcus@example.com", `${r.contacts[0].email}`);
    check("phone punctuation is stripped", r.contacts[0].phone === "5550101234", `${r.contacts[0].phone}`);
    check("a differently-punctuated phone normalises the same way", r.contacts[1].phone === "5550109999");
  }

  // Instagram handles in every form people paste them.
  check("an @handle loses the @", normalizeHandle("@kicksbykai") === "kicksbykai");
  check("a profile URL becomes a handle", normalizeHandle("https://www.instagram.com/kicksbykai/") === "kicksbykai");
  check("a bare handle is left alone", normalizeHandle("kicksbykai") === "kicksbykai");
  check("an empty handle is null", normalizeHandle("   ") === null);

  check("a short number isn't a phone", normalizePhone("911") === null);
  check("a real number is kept as digits", normalizePhone("+1 (555) 010-1234") === "15550101234");

  check("a good address passes", looksLikeEmail("a@b.co"));
  check("no TLD fails", !looksLikeEmail("a@b"));
  check("a space fails", !looksLikeEmail("a b@c.com"));
  check("a bare name fails", !looksLikeEmail("marcus"));

  // Bad rows are reported, not silently dropped.
  {
    const csv = [
      "name,email,phone",
      "Good Person,good@example.com,",
      ",,",
      ",,5550101234",
      "Bad Email Person,not-an-email,",
      "Good Person,good@example.com,",
    ].join("\n");
    const r = parseContacts(csv);
    // A row of nothing but commas is noise from a trailing newline, and
    // reporting it as an error would train people to ignore the report.
    // A row with actual data but no way to name the person is different:
    // that's information being dropped, so it gets said out loud.
    check("an entirely blank row is dropped quietly", !r.skipped.some((s) => s.line === 3));
    check("a row with data but no name is reported", r.skipped.some((s) => /No name/.test(s.reason)));
    check("a broken email is reported", r.skipped.some((s) => /unusable email/.test(s.reason)));
    check(
      "a person with a broken email is still kept",
      r.contacts.some((c) => c.name === "Bad Email Person" && c.email === null)
    );
    check("a duplicate inside one file is collapsed", r.skipped.some((s) => /Duplicate/.test(s.reason)));
    check("the duplicate isn't imported twice", r.contacts.filter((c) => c.email === "good@example.com").length === 1);
  }

  // Unknown columns are surfaced rather than swallowed.
  {
    const r = parseContacts("name,email,favourite colour\nA,a@b.com,red");
    check("unmapped columns are reported", r.unmappedColumns.includes("favourite colour"), r.unmappedColumns.join(","));
  }

  // A file that isn't a contacts export says so.
  {
    const r = parseContacts("sku,price\nDH1234,220");
    check("a non-contacts file is refused", r.contacts.length === 0);
    check("and explains why", r.skipped[0]?.reason.includes("No name or email column"), r.skipped[0]?.reason);
  }
  check("an empty file doesn't throw", parseContacts("").contacts.length === 0);

  // ---- Against the database -----------------------------------------
  const user = await prisma.user.create({
    data: { email: `${TAG}@example.invalid`, name: TAG },
    select: { id: true },
  });
  userId = user.id;
  const artist = await prisma.artistProfile.create({
    data: { userId, slug: `${TAG}-slug`, displayName: TAG, status: "APPROVED" },
    select: { id: true },
  });
  artistId = artist.id;

  const csv = [
    "Name,Email,Instagram,City",
    "Marcus Webb,marcus@example.com,@marcus,Brooklyn",
    "Tia Nguyen,tia@example.com,https://instagram.com/tia/,Queens",
    "No Email Guy,,@noemail,Bronx",
  ].join("\n");

  const first = await importContacts(artistId, parseContacts(csv));
  check("a first import creates every row", first.created === 3 && first.updated === 0, `${first.created}c/${first.updated}u`);

  // The behaviour that matters most: importing the same file again.
  const second = await importContacts(artistId, parseContacts(csv));
  check("re-importing the same file creates nothing", second.created === 0, `${second.created} created`);
  check("re-importing updates instead", second.updated === 3, `${second.updated} updated`);
  check(
    "the list didn't double",
    (await prisma.contact.count({ where: { artistId } })) === 3,
    `${await prisma.contact.count({ where: { artistId } })} rows`
  );

  // An import must never blank a note the artist typed themselves.
  await prisma.contact.updateMany({
    where: { artistId, email: "marcus@example.com" },
    data: { notes: "HAND TYPED — pays fast" },
  });
  await importContacts(artistId, parseContacts(csv));
  const marcus = await prisma.contact.findFirstOrThrow({ where: { artistId, email: "marcus@example.com" } });
  check("an import never erases a hand-typed note", marcus.notes === "HAND TYPED — pays fast", `${marcus.notes}`);

  // Consent. The whole reason this is a field and not an assumption.
  const anyOptedIn = await prisma.contact.count({ where: { artistId, emailOptIn: true } });
  check("nothing imported is opted in to email", anyOptedIn === 0, `${anyOptedIn} opted in`);
  check("imported rows are labelled as imported", marcus.source === "import", marcus.source);

  // ---- Sales history becomes a customer list ------------------------
  const sub = await prisma.submission.create({
    data: {
      title: `${TAG} piece`, artistName: TAG, email: `${TAG}@example.invalid`,
      baseShoe: "AF1", imageUrl: "/x.png", status: "APPROVED", artistId,
    },
    select: { id: true },
  });
  madeSubs.push(sub.id);

  const day = 86400000;
  for (const [price, when] of [[40000, 60], [55000, 10]] as const) {
    await prisma.sale.create({
      data: {
        submissionId: sub.id, sellerId: userId, buyerEmail: "marcus@example.com",
        priceCents: price, status: "CONFIRMED", soldAt: new Date(Date.now() - when * day),
      },
    });
  }

  const synced = await syncContactsFromSales(artistId);
  check("sales history finds its buyer", synced.touched === 1, `${synced.touched}`);

  const buyer = await prisma.contact.findFirstOrThrow({ where: { artistId, email: "marcus@example.com" } });
  check("spend totals across both sales", buyer.totalSpentCents === 95000, `${buyer.totalSpentCents}`);
  check("purchase count is right", buyer.purchaseCount === 2, `${buyer.purchaseCount}`);
  check("two purchases makes them REPEAT", buyer.stage === "REPEAT", buyer.stage);
  check("last contact is the most recent sale, not the first",
    Math.round((Date.now() - buyer.lastContactAt!.getTime()) / day) === 10,
    `${Math.round((Date.now() - buyer.lastContactAt!.getTime()) / day)}d`);
  check("a buyer still isn't opted in to marketing", buyer.emailOptIn === false);
  check("syncing didn't duplicate the imported contact",
    (await prisma.contact.count({ where: { artistId, email: "marcus@example.com" } })) === 1);

  const stats = await contactStats(artistId);
  check("stats count the whole book", stats.total === 3, `${stats.total}`);
  check("stats separate customers from leads", stats.customers === 1, `${stats.customers}`);
  check("stats count repeat buyers", stats.repeat === 1, `${stats.repeat}`);
  check("stats total the spend", stats.totalSpentCents === 95000, `${stats.totalSpentCents}`);

  // ---- One artist's list is not another's ---------------------------
  const otherUser = await prisma.user.create({
    data: { email: `${TAG}-other@example.invalid`, name: `${TAG} other` },
    select: { id: true },
  });
  const other = await prisma.artistProfile.create({
    data: { userId: otherUser.id, slug: `${TAG}-other`, displayName: `${TAG} other`, status: "APPROVED" },
    select: { id: true },
  });
  await importContacts(other.id, parseContacts("Name,Email\nMarcus Webb,marcus@example.com"));
  check(
    "the same person can exist for two artists independently",
    (await prisma.contact.count({ where: { email: "marcus@example.com" } })) === 2
  );
  const theirs = await prisma.contact.findFirstOrThrow({ where: { artistId: other.id } });
  check(
    "and the other artist sees none of the first one's history",
    theirs.totalSpentCents === 0 && theirs.purchaseCount === 0,
    `${theirs.totalSpentCents}/${theirs.purchaseCount}`
  );
  check("nor their private notes", theirs.notes === null, `${theirs.notes}`);
}

async function cleanup() {
  await prisma.contact.deleteMany({ where: { artist: { displayName: { startsWith: TAG } } } });
  await prisma.sale.deleteMany({ where: { submissionId: { in: madeSubs } } });
  await prisma.submission.deleteMany({ where: { id: { in: madeSubs } } });
  await prisma.artistProfile.deleteMany({ where: { displayName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
}

main()
  .catch((e) => {
    fail++;
    log.push(`FAIL threw — ${e instanceof Error ? e.message : String(e)}`);
  })
  .then(cleanup)
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n=== CONTACT IMPORT ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });

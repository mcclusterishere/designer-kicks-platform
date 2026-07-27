/**
 * The CRM: importing from everywhere, and the things only this one knows.
 *
 * Two halves.
 *
 * The first is migration. Nobody leaves a CRM because leaving costs them
 * their history, so the bar is not "reads a CSV" — it's "reads the file
 * HubSpot actually exports, and doesn't quietly bin the forty columns it
 * has no field for". Every fixture below is a real exporter's header row.
 *
 * The second is the part a general CRM structurally cannot do. Salesforce
 * has no concept of a shoe size, so it can never tell a maker which four
 * people on their list wear the 10.5 sitting on the bench. That data has
 * been in this database the whole time.
 *
 * Run: npm run verify:crm   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import {
  mapHeaders, detectSource, parseTags, parseMoneyCents, parseShoeSize, parseDate,
} from "../lib/crmImport";
import { parseContacts, importContacts } from "../lib/contacts";
import {
  logActivity, timeline, syncTimelineFromPlatform, contactList,
  sizeMatches, contactPortfolio, todaysSignals, openTasks,
} from "../lib/crm";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const TAG = "verify-crm";
const DAY = 86400000;
const ago = (d: number) => new Date(Date.now() - d * DAY);
let artistId = "";
const madeSubs: string[] = [];

async function main() {
  // ---- Recognising real exports --------------------------------------
  const FIXTURES: [string, string, string[]][] = [
    ["HubSpot", "HubSpot", ["Record ID", "First Name", "Last Name", "Email", "Phone Number", "Contact owner", "Lifecycle Stage"]],
    ["Mailchimp", "Mailchimp", ["Email Address", "First Name", "Last Name", "MEMBER_RATING", "TAGS"]],
    ["Shopify", "Shopify", ["First Name", "Last Name", "Email", "Accepts Marketing", "Total Spent", "Total Orders"]],
    ["Google Contacts", "Google Contacts", ["Given Name", "Family Name", "E-mail 1 - Value", "Phone 1 - Value"]],
    ["Salesforce", "Salesforce", ["First Name", "Last Name", "Email", "MailingCity", "Account Name"]],
  ];
  for (const [label, expected, headers] of FIXTURES) {
    check(`${label} is recognised by its columns`, detectSource(headers) === expected, `${detectSource(headers)}`);
  }
  check("an unknown exporter is reported as unknown, not guessed",
    detectSource(["name", "email"]) === null, `${detectSource(["name", "email"])}`);

  // ---- The columns we can't place must survive ------------------------
  {
    const headers = ["Email", "First Name", "Lifecycle Stage", "Deal Amount", "Record ID", "Favourite Colourway"];
    const m = mapHeaders(headers);
    check("core fields are mapped", m.index.email === 0 && m.index.firstName === 1);
    const kept = m.custom.map((c) => c.header);
    check("an unknown business column is KEPT", kept.includes("Lifecycle Stage"), kept.join(", "));
    check("a second one is kept too", kept.includes("Deal Amount") && kept.includes("Favourite Colourway"));
    // Money from a foreign tool must never land in the field this
    // platform computes from its own confirmed sales.
    check("a money column is preserved, not mapped to lifetime spend",
      m.index.totalSpent === undefined && kept.includes("Deal Amount"), JSON.stringify(m.index));
    check("exporter plumbing is dropped on purpose", m.ignored.includes("Record ID"), m.ignored.join(", "));
    check("plumbing is NOT kept as a custom field", !kept.includes("Record ID"));
  }

  // A column can only be claimed once, or two aliases fight over it.
  {
    const m = mapHeaders(["Name", "Full Name", "Email"]);
    const used = Object.values(m.index).filter((v) => v !== undefined);
    check("no two fields claim the same column", new Set(used).size === used.length, JSON.stringify(m.index));
  }

  // ---- Field parsers --------------------------------------------------
  check("tags split on commas", parseTags("vip, local, repeat").join("|") === "vip|local|repeat");
  check("tags split on semicolons too", parseTags("vip;local").length === 2);
  check("empty tag cells give nothing", parseTags("  ").length === 0);
  check("money with symbols parses", parseMoneyCents("$1,240.50") === 124050);
  check("a non-number isn't money", parseMoneyCents("n/a") === null);
  check("negative isn't money", parseMoneyCents("-5") === null);
  check("a plain size passes through", parseShoeSize("10.5") === "10.5");
  check('"US 10.5" loses the prefix', parseShoeSize("US 10.5") === "10.5");
  check("a women's size keeps its W", parseShoeSize("10.5W") === "W10.5");
  check("a real date parses", parseDate("2024-03-05")?.getFullYear() === 2024);
  check("garbage is not a date", parseDate("not a date") === null);
  check("a nonsense year is rejected", parseDate("0001-01-01") === null);

  // ---- End to end, on a HubSpot-shaped file ---------------------------
  const user = await prisma.user.create({
    data: { email: `${TAG}-a@example.invalid`, name: TAG },
    select: { id: true },
  });
  const artist = await prisma.artistProfile.create({
    data: { userId: user.id, slug: `${TAG}-a`, displayName: `${TAG} Artist`, status: "APPROVED" },
    select: { id: true },
  });
  artistId = artist.id;

  const hubspot = [
    "Record ID,First Name,Last Name,Email,Phone Number,Lifecycle Stage,Contact owner,Shoe Size,Tags",
    "101,Marcus,Webb,marcus@example.com,(555) 010-1234,Customer,Dekota,10.5,\"vip, local\"",
    "102,Tia,Nguyen,tia@example.com,5550109999,Lead,Dekota,9,collector",
  ].join("\n");

  const report = parseContacts(hubspot);
  check("the HubSpot file is recognised", report.source === "HubSpot", `${report.source}`);
  check("both rows parse", report.contacts.length === 2, `${report.contacts.length}`);
  check("shoe size is captured", report.contacts[0].shoeSize === "10.5", `${report.contacts[0].shoeSize}`);
  check("tags are captured", report.contacts[0].tags.join("|") === "vip|local", report.contacts[0].tags.join("|"));
  check(
    "the lifecycle stage we have no field for is kept",
    report.contacts[0].customFields["Lifecycle Stage"] === "Customer",
    JSON.stringify(report.contacts[0].customFields)
  );
  check("so is the deal owner", report.contacts[0].customFields["Contact owner"] === "Dekota");
  check("the kept columns are reported to the artist", report.keptColumns.includes("Lifecycle Stage"));

  const result = await importContacts(artistId, report);
  check("the import writes both", result.created === 2, `${result.created}`);

  const marcus = await prisma.contact.findFirstOrThrow({
    where: { artistId, email: "marcus@example.com" },
  });
  check("size persisted", marcus.shoeSize === "10.5", `${marcus.shoeSize}`);
  check("tags persisted", marcus.tags.includes("vip"), marcus.tags.join(","));
  check("custom fields persisted", (marcus.customFields as Record<string, string>)["Lifecycle Stage"] === "Customer");
  check("the source tool is recorded on the row", marcus.importSource === "HubSpot", `${marcus.importSource}`);

  // Importing a SECOND tool's export must add to the record, not wipe it.
  const shopify = [
    "First Name,Last Name,Email,Total Spent,Tags,Accepts Marketing",
    "Marcus,Webb,marcus@example.com,$1240.50,\"buyer\",yes",
  ].join("\n");
  await importContacts(artistId, parseContacts(shopify));
  const merged = await prisma.contact.findFirstOrThrow({
    where: { artistId, email: "marcus@example.com" },
  });
  check("a second tool's tags merge in", merged.tags.includes("vip") && merged.tags.includes("buyer"), merged.tags.join(","));
  check(
    "and the first tool's custom fields survive",
    (merged.customFields as Record<string, string>)["Lifecycle Stage"] === "Customer",
    JSON.stringify(merged.customFields)
  );
  check(
    "while the second tool's are added",
    (merged.customFields as Record<string, string>)["Accepts Marketing"] === "yes"
  );
  check("still one row, not two", (await prisma.contact.count({ where: { artistId, email: "marcus@example.com" } })) === 1);

  // ---- Timeline --------------------------------------------------------
  await logActivity({ contactId: marcus.id, kind: "CALL", body: "Talked sizing", occurredAt: ago(2) });
  await logActivity({ contactId: marcus.id, kind: "NOTE", body: "Wants a 4 next", occurredAt: ago(1) });
  const tl = await timeline(marcus.id);
  check("the timeline records both events", tl.length === 2, `${tl.length}`);
  check("newest first", tl[0].body === "Wants a 4 next", tl[0].body);

  const touched = await prisma.contact.findFirstOrThrow({ where: { id: marcus.id } });
  check("a call counts as human contact", touched.lastContactAt !== null);

  // Platform events must never double-post.
  const sub = await prisma.submission.create({
    data: { title: `${TAG} piece`, artistName: `${TAG} Artist`, email: `${TAG}@x.invalid`,
            baseShoe: "AF1", imageUrl: "/x.png", status: "APPROVED", artistId, ownerId: null },
    select: { id: true },
  });
  madeSubs.push(sub.id);
  await prisma.sale.create({
    data: { submissionId: sub.id, sellerId: user.id, buyerEmail: "marcus@example.com",
            priceCents: 65000, soldAt: ago(30), status: "CONFIRMED" },
  });

  const first = await syncTimelineFromPlatform(artistId);
  check("a real sale lands on the timeline", first.added === 1, `${first.added}`);
  const second = await syncTimelineFromPlatform(artistId);
  check("running the sync twice adds nothing", second.added === 0, `${second.added}`);
  const tl2 = await timeline(marcus.id);
  check("the sale appears exactly once", tl2.filter((t) => t.kind === "CLAIM").length === 1);

  // ---- Segments and search --------------------------------------------
  await prisma.contact.update({
    where: { id: marcus.id },
    data: { purchaseCount: 2, totalSpentCents: 120000, lastContactAt: ago(200) },
  });
  check("the 'came back' segment finds repeat buyers",
    (await contactList(artistId, { segment: "repeat" })).length === 1);
  check("the 'never bought' segment excludes them",
    !(await contactList(artistId, { segment: "leads" })).some((c) => c.id === marcus.id));
  check("the 'gone quiet' segment catches a 200-day silence",
    (await contactList(artistId, { segment: "quiet" })).some((c) => c.id === marcus.id));
  check("search matches a name", (await contactList(artistId, { q: "Marcus" })).length === 1);
  check("search matches an email", (await contactList(artistId, { q: "tia@" })).length === 1);
  check("search matches nothing when it should",
    (await contactList(artistId, { q: "zzzzz-no-such-person" })).length === 0);

  // ---- The part no other CRM can do ------------------------------------
  const tens = await sizeMatches(artistId, "10.5");
  check("size match finds the person who wears it", tens.length === 1 && tens[0].email === "marcus@example.com", `${tens.length}`);
  check("size match excludes other sizes", (await sizeMatches(artistId, "9")).every((c) => c.email !== "marcus@example.com"));
  check('"US 10.5" matches "10.5"', (await sizeMatches(artistId, "US 10.5")).length === 1);
  check("an unknown size matches nobody", (await sizeMatches(artistId, "14")).length === 0);

  // Portfolio: a piece owned, with a live offer above what they paid.
  const buyerUser = await prisma.user.create({
    data: { email: `${TAG}-buyer@example.invalid`, name: `${TAG} buyer` },
    select: { id: true },
  });
  await prisma.submission.update({ where: { id: sub.id }, data: { ownerId: buyerUser.id } });
  await prisma.offer.create({
    data: { submissionId: sub.id, buyerId: user.id, amountCents: 91000, status: "OPEN" },
  });

  const folio = await contactPortfolio(buyerUser.id, artistId);
  check("the portfolio finds what they hold", folio.pieces.length === 1, `${folio.pieces.length}`);
  check("valued at the live offer, not a guess", folio.valueCents === 91000, `${folio.valueCents}`);
  check("against what they actually paid", folio.paidCents === 65000, `${folio.paidCents}`);
  check("and reports the gain", folio.changePct === 40, `${folio.changePct}%`);
  check("no account means no portfolio, not a crash", (await contactPortfolio(null, artistId)).pieces.length === 0);

  // Signals: every one must cite a fact.
  await prisma.contact.update({ where: { id: marcus.id }, data: { userId: buyerUser.id } });
  await prisma.contactTask.create({
    data: { contactId: marcus.id, title: "Send the 4 mockup", dueAt: ago(2) },
  });
  const signals = await todaysSignals(artistId);
  check("signals are produced", signals.length > 0, `${signals.length}`);
  check("each cites a specific reason", signals.every((s) => s.reason.length > 20));
  check("one person appears at most once", new Set(signals.map((s) => s.contactId)).size === signals.length);
  check("the overdue reminder outranks a stale-contact nudge",
    signals[0].reason.includes("bid") || signals[0].reason.includes("reminder"), signals[0].reason);

  const tasks = await openTasks(artistId);
  check("an open task is listed", tasks.length === 1, `${tasks.length}`);
  check("and flagged overdue", tasks[0].overdue === true);

  // ---- Isolation, again, because it's a customer list ------------------
  const otherUser = await prisma.user.create({
    data: { email: `${TAG}-o@example.invalid`, name: `${TAG} o` }, select: { id: true },
  });
  const other = await prisma.artistProfile.create({
    data: { userId: otherUser.id, slug: `${TAG}-o`, displayName: `${TAG} Other`, status: "APPROVED" },
    select: { id: true },
  });
  check("another artist sees none of this book", (await contactList(other.id)).length === 0);
  check("and gets no size matches from it", (await sizeMatches(other.id, "10.5")).length === 0);
  check("and no signals from it", (await todaysSignals(other.id)).length === 0);
}

async function cleanup() {
  const ids = (await prisma.contact.findMany({
    where: { artist: { displayName: { startsWith: TAG } } }, select: { id: true },
  })).map((c) => c.id);
  await prisma.contactTask.deleteMany({ where: { contactId: { in: ids } } });
  await prisma.contactActivity.deleteMany({ where: { contactId: { in: ids } } });
  await prisma.contact.deleteMany({ where: { id: { in: ids } } });
  await prisma.offer.deleteMany({ where: { submissionId: { in: madeSubs } } });
  await prisma.sale.deleteMany({ where: { submissionId: { in: madeSubs } } });
  await prisma.submission.deleteMany({ where: { id: { in: madeSubs } } });
  await prisma.submission.deleteMany({ where: { artistName: { startsWith: TAG } } });
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
    console.log("\n=== CRM: IMPORT + INTELLIGENCE ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });

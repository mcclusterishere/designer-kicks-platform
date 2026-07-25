// Secret-leak sweep over the public surface.
//
// This exists because of a real one. Public artist pages were serving the
// artist's bcrypt password hash in their HTML — harvestable with curl,
// crackable offline. The query selected `passwordHash` so the page could
// derive "is this profile unclaimed", with a comment stating the hash must
// not leak, and the page then passed that whole object into a client
// component. TypeScript allowed it (the prop type was narrower, structural
// typing accepts a wider object) and types erase at runtime, so React
// serialised the real object into the payload. Nothing failed. Nothing
// warned. It just quietly published a secret on every artist page.
//
// A comment can't enforce that and a type can't either, so a test does.
// This fetches the real public pages and greps the bytes actually sent.
import { PrismaClient } from "@prisma/client";
import { BASE, makeChecker } from "./helpers.mjs";

const prisma = new PrismaClient();
const results = [];
const check = makeChecker(results);

/** Things that must never appear in a public response body. */
const FORBIDDEN = [
  { name: "bcrypt hash", re: /\$2[aby]\$\d{2}\$[A-Za-z0-9./]{20,}/ },
  { name: "passwordHash key", re: /passwordHash/ },
  { name: "buyerEmail key", re: /buyerEmail/ },
  { name: "resetToken", re: /resetTokenHash|resetToken"/ },
  { name: "session token", re: /authjs\.session-token/ },
  { name: "API key shape", re: /sk_live_|sk_test_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{30,}/ },
  // The second wave, found by an adversarial review after the hash fix:
  // an `include` with no omit returns every scalar, so the submitter's
  // contact details and the consignor's name rode into the payload too.
  // Consignment's own schema comment promises consignorName stays private.
  { name: "socialHandle key", re: /socialHandle/ },
  { name: "consignorName key", re: /consignorName/ },
  { name: "any email address", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(com|net|org|io|co)\b/ },
];

async function sweep(label, url) {
  const res = await fetch(url);
  const body = await res.text();
  const hits = FORBIDDEN.filter((f) => f.re.test(body)).map((f) => f.name);
  check(`${label} carries no secrets`, hits.length === 0, hits.join(", ") || `${res.status}`);
  return body.length;
}

try {
  // Every public artist page — the surface that actually leaked.
  const artists = await prisma.artistProfile.findMany({
    where: { status: "APPROVED" },
    select: { slug: true },
    take: 40,
  });
  check("there are artist pages to sweep", artists.length > 0, `${artists.length} approved`);
  for (const a of artists) {
    await sweep(`/artists/${a.slug}`, `${BASE}/artists/${a.slug}`);
  }

  // Collector pages publish someone else's closet — same risk shape.
  const collectors = await prisma.user.findMany({
    where: { collectorSlug: { not: null } },
    select: { collectorSlug: true },
    take: 10,
  });
  for (const c of collectors) {
    await sweep(`/collectors/${c.collectorSlug}`, `${BASE}/collectors/${c.collectorSlug}`);
  }

  // The rest of the logged-out public surface, for good measure.
  for (const path of ["/", "/artists", "/heat-list", "/market", "/drops", "/news", "/quiz"]) {
    await sweep(path, `${BASE}${path}`);
  }

  // A claim link is public by design (the buyer may have no account yet),
  // so it must mask the address rather than print it.
  const sale = await prisma.sale.findFirst({ select: { id: true, buyerEmail: true } });
  if (sale) {
    const body = await (await fetch(`${BASE}/claim/${sale.id}`)).text();
    check("claim page masks the buyer's email", !body.includes(sale.buyerEmail), sale.id);
  }
} finally {
  await prisma.$disconnect();
}

console.log("\n=== SECRET LEAK SWEEP ===");
for (const r of results) console.log(r);

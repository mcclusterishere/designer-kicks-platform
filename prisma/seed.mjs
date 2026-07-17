// Seeds demo submissions, battles, votes, and the affiliate shop.
// Run with: npm run db:seed  (safe to re-run — it wipes and reseeds demo data)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

const submissions = [
  {
    key: "toxic",
    title: "Toxic Drip AF1",
    artistName: "Krylon Kelz",
    socialHandle: "krylonkelz",
    email: "demo+kelz@designerkicks.example",
    baseShoe: "Nike Air Force 1",
    description:
      "Angelus neon set over a blacked-out base, drip effect done freehand, finished with matte acrylic sealer.",
    imageUrl: "/seed/custom-1.svg",
  },
  {
    key: "molten",
    title: "Molten Lava Dunk",
    artistName: "SoleFire Studio",
    socialHandle: "solefirestudio",
    email: "demo+solefire@designerkicks.example",
    baseShoe: "Nike Dunk Low",
    description:
      "Heat-map fade from the sole up, hand-painted crackle texture, custom red laces with brass aglets.",
    imageUrl: "/seed/custom-2.svg",
  },
  {
    key: "frost",
    title: "Frostbite 990s",
    artistName: "IceBox Customs",
    socialHandle: "iceboxcustoms",
    email: "demo+icebox@designerkicks.example",
    baseShoe: "New Balance 990v6",
    description: "Icy translucent midsole swap, arctic gradient suede dye, reflective stitching.",
    imageUrl: "/seed/custom-3.svg",
  },
  {
    key: "neon",
    title: "Neon Riot AJ1",
    artistName: "Riot Grrl Kicks",
    socialHandle: "riotgrrlkicks",
    email: "demo+riot@designerkicks.example",
    baseShoe: "Air Jordan 1 High",
    description: "UV-reactive pink panels, hand-cut stencil graffiti, glow-in-the-dark outsole.",
    imageUrl: "/seed/custom-4.svg",
  },
  {
    key: "gold",
    title: "24K Court Kings",
    artistName: "Midas Touch",
    socialHandle: "midastouchcustoms",
    email: "demo+midas@designerkicks.example",
    baseShoe: "Air Jordan 4",
    description: "Gold-leaf wings, tonal cream base, aged lace tips for the vintage grail look.",
    imageUrl: "/seed/custom-5.svg",
  },
  {
    key: "galaxy",
    title: "Galaxy Foam Runners",
    artistName: "Nebula Lab",
    socialHandle: "nebulalab",
    email: "demo+nebula@designerkicks.example",
    baseShoe: "Yeezy Foam Runner",
    description: "Hydro-dipped nebula wash, airbrushed star field, pearlescent top coat.",
    imageUrl: "/seed/custom-6.svg",
  },
  {
    key: "venom",
    title: "Venom Strike SB",
    artistName: "Krylon Kelz",
    socialHandle: "krylonkelz",
    email: "demo+kelz@designerkicks.example",
    baseShoe: "Nike SB Dunk",
    description: "Scale texture carved into the leather, venom-green fade, custom snake-eye dubraes.",
    imageUrl: "/seed/custom-7.svg",
  },
  {
    key: "bred",
    title: "Bred Heat 11s",
    artistName: "SoleFire Studio",
    socialHandle: "solefirestudio",
    email: "demo+solefire@designerkicks.example",
    baseShoe: "Air Jordan 11",
    description: "Patent leather re-dye, ember airbrush on the mudguard, red translucent sole swap.",
    imageUrl: "/seed/custom-8.svg",
  },
];

// Affiliate marketplace starter set. URLs are PLAIN merchant links —
// swap in your tagged affiliate links from AFFILIATES.md as you get
// approved for each program (edit in /admin).
const products = [
  // Marketplaces
  { name: "Hyped + Rare Pairs", merchant: "StockX", category: "marketplace", blurb: "Live-market pricing on the most hyped releases.", affiliateUrl: "https://stockx.com/sneakers", featured: true, sortOrder: 1 },
  { name: "Authenticated Grails", merchant: "GOAT", category: "marketplace", blurb: "New + used grails, every pair verified.", affiliateUrl: "https://www.goat.com/sneakers", sortOrder: 2 },
  { name: "Rare Sneaker Vault", merchant: "Flight Club", category: "marketplace", blurb: "The consignment OG for deadstock heat.", affiliateUrl: "https://www.flightclub.com/", sortOrder: 3 },
  { name: "Region-Exclusive Drops", merchant: "KicksCrew", category: "marketplace", blurb: "Overseas exclusives you can't get at home.", affiliateUrl: "https://www.kickscrew.com/", sortOrder: 4 },
  // Retail
  { name: "New Release Wall", merchant: "Foot Locker", category: "retail", blurb: "Launch calendar staples and restocks.", affiliateUrl: "https://www.footlocker.com/category/shoes.html", sortOrder: 10 },
  { name: "Hype Drops + Exclusives", merchant: "JD Sports", category: "retail", blurb: "Frequent exclusives on the newest silhouettes.", affiliateUrl: "https://www.jdsports.com/", sortOrder: 11 },
  { name: "Boutique Launches", merchant: "END. Clothing", category: "retail", blurb: "Boutique collabs, raffles, and limited runs.", affiliateUrl: "https://www.endclothing.com/us/footwear", sortOrder: 12 },
  { name: "Nike By You Customs", merchant: "Nike", category: "retail", blurb: "Factory-custom colorways straight from Nike.", affiliateUrl: "https://www.nike.com/nike-by-you", sortOrder: 13 },
  // Customization supplies
  { name: "Leather Paint Starter Kit", merchant: "Angelus Direct", category: "customization", blurb: "The industry-standard paints every customizer starts with.", price: "From $34.99", affiliateUrl: "https://angelusdirect.com/collections/paint-kits", featured: true, sortOrder: 20 },
  { name: "Neon Collection Paints", merchant: "Angelus Direct", category: "customization", blurb: "The glow-bright colors behind half the customs in the arena.", price: "From $4.49", affiliateUrl: "https://angelusdirect.com/collections/neon-collection", sortOrder: 21 },
  { name: "Finisher + Sealer Range", merchant: "Angelus Direct", category: "customization", blurb: "Matte to high-gloss topcoats that lock your work in.", price: "From $5.99", affiliateUrl: "https://angelusdirect.com/collections/finishers", sortOrder: 22 },
  // Cleaning
  { name: "Signature Cleaning Kit", merchant: "Reshoevn8r", category: "cleaning", blurb: "3-brush deep-clean system the resellers swear by.", price: "From $29.95", affiliateUrl: "https://reshoevn8r.com/collections/cleaning-kits", featured: true, sortOrder: 30 },
  { name: "Rain & Stain Spray", merchant: "Crep Protect", category: "cleaning", blurb: "Hydrophobic shield before the first wear. Non-negotiable.", price: "From $14.99", affiliateUrl: "https://crepprotect.com/collections/all", sortOrder: 31 },
  { name: "Premium Shoe Cleaner", merchant: "Jason Markk", category: "cleaning", blurb: "Gentle enough for suede, strong enough for midsoles.", price: "From $8", affiliateUrl: "https://jasonmarkk.com/collections/shoe-care", sortOrder: 32 },
  // Accessories
  { name: "Premium Rope Laces", merchant: "Lace Lab", category: "accessories", blurb: "The lace swap that finishes a custom.", price: "From $8.99", affiliateUrl: "https://www.lacelab.com/collections/rope-laces", featured: true, sortOrder: 40 },
  { name: "Crease Protectors", merchant: "Amazon", category: "accessories", blurb: "Keep the toe box crispy between wears.", price: "From $9.99", affiliateUrl: "https://www.amazon.com/s?k=sneaker+crease+protector", sortOrder: 41 },
  { name: "Sneaker Display Cases", merchant: "Amazon", category: "accessories", blurb: "Stack and show the collection properly.", price: "From $24.99", affiliateUrl: "https://www.amazon.com/s?k=sneaker+display+case", sortOrder: 42 },
  { name: "Cedar Shoe Trees", merchant: "Amazon", category: "accessories", blurb: "Shape + moisture control for pairs that matter.", price: "From $19.99", affiliateUrl: "https://www.amazon.com/s?k=cedar+shoe+trees", sortOrder: 43 },
];

async function main() {
  // Wipe in dependency order so reseeding is idempotent.
  await prisma.vote.deleteMany();
  await prisma.battle.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.product.deleteMany();

  const subs = {};
  for (const { key, ...data } of submissions) {
    subs[key] = await prisma.submission.create({
      data: { ...data, status: "APPROVED" },
    });
  }

  const now = Date.now();

  const battles = [
    { a: "toxic", b: "molten", title: "AF1 vs Dunk — Neon Round", endsAt: new Date(now + 5 * DAY), aVotes: 12, bVotes: 9 },
    { a: "frost", b: "neon", title: "Ice vs Fire", endsAt: new Date(now + 7 * DAY), aVotes: 5, bVotes: 8 },
    { a: "gold", b: "galaxy", title: "Luxury vs Space", endsAt: new Date(now - 2 * DAY), aVotes: 34, bVotes: 21, completed: true },
    { a: "venom", b: "bred", title: "Serpent vs Ember", endsAt: new Date(now - 5 * DAY), aVotes: 38, bVotes: 41, completed: true },
  ];

  let voterSeq = 0;
  for (const b of battles) {
    const subA = subs[b.a];
    const subB = subs[b.b];
    const battle = await prisma.battle.create({
      data: {
        title: b.title,
        subAId: subA.id,
        subBId: subB.id,
        endsAt: b.endsAt,
        status: b.completed ? "COMPLETED" : "ACTIVE",
        winnerId: b.completed ? (b.aVotes >= b.bVotes ? subA.id : subB.id) : null,
      },
    });
    const votes = [];
    for (let i = 0; i < b.aVotes; i++) votes.push({ battleId: battle.id, submissionId: subA.id, voterKey: `seed-voter-${voterSeq++}` });
    for (let i = 0; i < b.bVotes; i++) votes.push({ battleId: battle.id, submissionId: subB.id, voterKey: `seed-voter-${voterSeq++}` });
    await prisma.vote.createMany({ data: votes });
  }

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  console.log(
    `Seeded ${submissions.length} submissions, ${battles.length} battles, ${products.length} products.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Seeds demo submissions, battles, votes, the affiliate shop, the
// trivia question bank (prisma/questions.json), and a demo giveaway.
// Run with: npm run db:seed  (safe to re-run — it wipes and reseeds
// demo content; it does NOT touch user accounts)
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();
const here = path.dirname(fileURLToPath(import.meta.url));

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

// Drop Report seed articles. Release info researched July 2026 from
// sneaker release calendars (Sole Retriever, Sneaker Bar Detroit, Nice
// Kicks, Sneaker News, House of Heat) — dates shift, re-verify before
// promoting a post.
const articles = [
  {
    slug: "air-jordan-4-tour-yellow-release-date-2026",
    title: "Air Jordan 4 'Tour Yellow' Release Date: The 20-Year Wait Ends September 5",
    excerpt:
      "The Air Jordan 4 'Tour Yellow' finally retros September 5, 2026 for $220 (IO2463-102). Release info, where to cop, and why this one will not sit.",
    tags: "Jordan, Release Dates, SNKRS",
    coverImage: "/seed/news-1.svg",
    daysAgo: 1,
    content: [
      "## The drop at a glance",
      "",
      "| | |",
      "|---|---|",
      "| **Release date** | September 5, 2026 |",
      "| **Retail price** | $220 |",
      "| **Style code** | IO2463-102 |",
      "| **Colorway** | White / Tour Yellow / Dark Blue Grey / Black |",
      "| **Where** | Nike SNKRS + select Jordan Brand retailers |",
      "",
      "## Why this one matters",
      "",
      "The 'Tour Yellow' Air Jordan 4 dropped once — May 2006 — and then vanished for two decades. This September it gets its **first retro ever**, and colorways that skip a generation are exactly the ones that disappear on release day. Rare Air-era nostalgia is real, and AJ4s are consistently among the most-flipped retros on the market.",
      "",
      "## How to cop",
      "",
      "1. **SNKRS draw** — enter the minute it goes live; set a reminder now.",
      "2. **Retailer raffles** — most Jordan accounts run raffles in the days before the drop.",
      "3. **Miss it?** Marketplaces like StockX, GOAT, and KicksCrew will have pairs above retail — check our [Shop](/shop) for the marketplaces we trust.",
      "",
      "## The customizer angle",
      "",
      "That white-and-yellow blocking is basically a blank canvas with a head start. If you grab a pair and flip it into something the culture has never seen, [submit it to the Battle Arena](/submit) — Tour Yellow customs are going to be a wave this fall.",
      "",
      "*Release dates can shift — follow the Drop Report for updates.*",
    ].join("\n"),
  },
  {
    slug: "air-jordan-1-royal-2026-release-date",
    title: "Air Jordan 1 'Royal' Is Back October 10 — First OG-Leather Version in 9 Years",
    excerpt:
      "The Air Jordan 1 High OG 'Royal' returns October 10, 2026 for $185 (IQ5495-005) in smooth 1985-style leather. Everything we know about the grail's fourth-ever release.",
    tags: "Jordan, Release Dates, Grails",
    coverImage: "/seed/news-2.svg",
    daysAgo: 3,
    content: [
      "## The drop at a glance",
      "",
      "| | |",
      "|---|---|",
      "| **Release date** | October 10, 2026 |",
      "| **Retail price** | $185 |",
      "| **Style code** | IQ5495-005 |",
      "| **Colorway** | Black / Royal Blue |",
      "| **Where** | Nike SNKRS, Foot Locker, Finish Line, select Jordan retailers |",
      "",
      "## One of the three original grails",
      "",
      "Bred. Chicago. **Royal.** Those are the three 1985 originals, and the Royal has only ever seen three High OG releases. This fourth release matters because Nike is going back to the **smooth leather closer to the 1985 original** — not the tumbled leather of the 2017 pair — which is exactly what collectors have been asking for.",
      "",
      "Expect one of the most contested SNKRS drops of Q4. If you only chase one pair this fall, this is a defensible pick.",
      "",
      "## How to cop",
      "",
      "- **SNKRS** — it will almost certainly be a draw, not first-come-first-served.",
      "- **Foot Locker / Finish Line apps** — reservation systems give you extra entries.",
      "- **Resale reality check** — Royals historically hold strong above retail. If you strike out, check the [marketplaces in our Shop](/shop) and know the market price before you pay it.",
      "",
      "## Keep them alive",
      "",
      "Black and royal blue shows every scuff. Ice the outsoles, protect them before first wear — the [care gear in our Shop](/shop) is what we actually use.",
      "",
      "*Release dates can shift — follow the Drop Report for updates.*",
    ].join("\n"),
  },
  {
    slug: "air-jordan-6-oreo-2026-release-date",
    title: "Air Jordan 6 'Oreo' Returns August 8 After 16 Years — Release Info & Where To Buy",
    excerpt:
      "The Air Jordan 6 'Oreo' retros August 8, 2026 for $215 (CT8529-108) — its first return since 2010. Release details, stockists, and resale outlook.",
    tags: "Jordan, Release Dates, SNKRS",
    coverImage: "/seed/news-3.svg",
    daysAgo: 5,
    content: [
      "## The drop at a glance",
      "",
      "| | |",
      "|---|---|",
      "| **Release date** | August 8, 2026 |",
      "| **Retail price** | $215 |",
      "| **Style code** | CT8529-108 |",
      "| **Colorway** | White / Black — white tumbled leather, black speckled suede |",
      "| **Where** | Nike.com / SNKRS, Finish Line, Foot Locker, JD Sports, Hibbett |",
      "",
      "## 16 years is a long time",
      "",
      "The 'Oreo' 6 last released in **2010**, and this return stays close to the original blocking — white tumbled leather up top, black speckled midsole doing the cookie work. Long-dormant colorways carry real nostalgia demand: people who missed it as teenagers now have adult money.",
      "",
      "Expect a fast sell-through. Wide sizing helps your odds, but do not sleep on release morning.",
      "",
      "## How to cop",
      "",
      "1. SNKRS + Nike.com at 10AM ET on drop day.",
      "2. Finish Line and Foot Locker app reservations open earlier in the week.",
      "3. JD Sports and Hibbett raffles are consistently underrated odds.",
      "",
      "Miss it? [Our Shop's marketplace links](/shop) get you authenticated pairs without the fake-check anxiety.",
      "",
      "*Release dates can shift — follow the Drop Report for updates.*",
    ].join("\n"),
  },
  {
    slug: "travis-scott-jordan-1-reverse-mocha-high-2026",
    title: "Travis Scott x Air Jordan 1 High 'Reverse Mocha': What We Know So Far",
    excerpt:
      "The rumored Travis Scott Air Jordan 1 High 'Reverse Mocha' is expected fall 2026 around $200. Colorway details, expected SNKRS draw info, and resale outlook.",
    tags: "Travis Scott, Jordan, Rumors",
    coverImage: "/seed/news-4.svg",
    daysAgo: 7,
    content: [
      "## Rumor status: strong, but not official",
      "",
      "Nothing confirmed by Nike yet — treat everything below as the current best intel, expected to land **fall 2026** (September–November window).",
      "",
      "| | |",
      "|---|---|",
      "| **Expected window** | Fall 2026 (rumored) |",
      "| **Expected price** | ~$200 |",
      "| **Colorway** | White tumbled leather, brown suede, black reverse Swoosh, sail midsole |",
      "| **Where** | Nike SNKRS (likely exclusive-access/draw), travisscott.com |",
      "",
      "## Why it is the most anticipated shoe of the year",
      "",
      "This is the **high-top follow-up to 2022's Reverse Mocha Low** — the shoe that broke SNKRS entry records. It inverts the blocking of the 2019 'Mocha' High that started the whole Travis AJ1 era. Travis Scott AJ1 Highs are the most heavily traded modern Jordans, and early expectations put resale in the several-hundred-to-four-figure range.",
      "",
      "## Realistic ways in",
      "",
      "- **SNKRS exclusive access** — buy Jordan product on your Nike account all year; access drops favor active accounts.",
      "- **travisscott.com surprise drops** — his site drops with minimal warning. Notifications on.",
      "- **Resale** — if you pay after-market, use authenticated platforms only. This will be the most-faked shoe of the year the week it drops. [Trusted marketplaces here](/shop).",
      "",
      "*We will update this story as real dates surface — the Drop Report has it first.*",
    ].join("\n"),
  },
  {
    slug: "august-2026-sneaker-release-dates-calendar",
    title: "August 2026 Sneaker Release Dates: Every Drop That Actually Matters",
    excerpt:
      "The full August 2026 sneaker release calendar — Jordan 1 'Love Letter', Flint 13s, Oreo 6s, three Kobe Protros, and the Space Jam 9s, with dates and prices.",
    tags: "Release Dates, Calendar, SNKRS",
    coverImage: "/seed/news-5.svg",
    daysAgo: 0,
    content: [
      "## The calendar",
      "",
      "| Date | Release | Price |",
      "|---|---|---|",
      "| Aug 1 | Air Jordan 1 High OG 'Love Letter' (DZ5485-201) | $185 |",
      "| Aug 1 | Air Jordan 13 Retro 'Flint' (IW3808-400) | $215 |",
      "| Aug 8 | Air Jordan 6 'Oreo' (CT8529-108) | $215 |",
      "| Aug 8 | Nike Kobe 8 Protro 'Mambacurial' | $200 |",
      "| Aug 15 | Nike Kobe 5 Protro 'Dodgers' | $190 |",
      "| Aug 23 | Kobe 10 Elite Low Protro 'Halo' (Mamba Day) | TBC |",
      "| Aug 29 | Air Jordan 9 Retro OG 'Space Jam' (HV4794-106) | $215 |",
      "",
      "## The ones to actually chase",
      "",
      "**Jordan 1 'Love Letter' (Aug 1)** — MJ's retirement letter to basketball, printed on the medial side. Story pairs like this age well.",
      "",
      "**Jordan 6 'Oreo' (Aug 8)** — first return in 16 years. [Full breakdown here](/news/air-jordan-6-oreo-2026-release-date).",
      "",
      "**The Kobe month** — three Protro drops in four weeks, capped by Mamba Day on August 23. Kobe releases are still the hardest wins on SNKRS; enter everything.",
      "",
      "**Space Jam 9s (Aug 29)** — timed to the movie's 30th anniversary with OG-style packaging and shaping closer to the 1993 original.",
      "",
      "## Game plan",
      "",
      "1. Load your SNKRS payment info **now**, not at 9:59 on drop day.",
      "2. Enter every retailer raffle — Foot Locker, Finish Line, JD, Hibbett. Odds compound.",
      "3. Set a resale ceiling before each drop so you never panic-buy. [Marketplace links in the Shop](/shop).",
      "",
      "And when your pairs land — you know what to do. Paint them, flip them into something nobody else has, and [enter the Battle Arena](/submit).",
      "",
      "*Dates from Nike/retailer calendars as of mid-July 2026; they shift often. Bookmark this page — we keep it current.*",
    ].join("\n"),
  },
];

function loadQuestions() {
  try {
    const raw = readFileSync(path.join(here, "questions.json"), "utf8");
    const parsed = JSON.parse(raw);
    return parsed.filter(
      (q) =>
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.answerIndex) &&
        q.answerIndex >= 0 &&
        q.answerIndex <= 3
    );
  } catch {
    return [];
  }
}

async function main() {
  // Wipe in dependency order so reseeding is idempotent.
  // User accounts, quiz runs, credits, and giveaway entries are kept.
  await prisma.vote.deleteMany({ where: { userId: null } });
  await prisma.battle.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.product.deleteMany();
  await prisma.article.deleteMany();
  await prisma.quizQuestion.deleteMany();

  // Demo artists get real (passwordless) accounts + league profiles so
  // the rankings and artist pages work out of the box.
  const artistIds = {};
  for (const s of submissions) {
    if (artistIds[s.artistName] !== undefined) continue;
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { name: s.artistName, email: s.email },
    });
    const slug = s.artistName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/[\s-]+/g, "-");
    const profile = await prisma.artistProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        slug,
        displayName: s.artistName,
        instagram: s.socialHandle ?? null,
      },
    });
    artistIds[s.artistName] = profile.id;
  }

  const subs = {};
  for (const { key, ...data } of submissions) {
    subs[key] = await prisma.submission.create({
      data: { ...data, status: "APPROVED", artistId: artistIds[data.artistName] },
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

  for (const { daysAgo, ...a } of articles) {
    await prisma.article.create({
      data: {
        ...a,
        status: "PUBLISHED",
        publishedAt: new Date(now - daysAgo * DAY),
      },
    });
  }

  const questions = loadQuestions();
  for (const q of questions) {
    await prisma.quizQuestion.create({
      data: {
        question: q.question,
        options: JSON.stringify(q.options),
        answerIndex: q.answerIndex,
        difficulty: [1, 2, 3].includes(q.difficulty) ? q.difficulty : 2,
        category: q.category || "history",
        explanation: q.explanation || null,
      },
    });
  }

  // Keep any giveaway that's already running; otherwise start the demo one.
  const activeGiveaway = await prisma.giveaway.findFirst({
    where: { status: "ACTIVE", endsAt: { gt: new Date() } },
  });
  if (!activeGiveaway) {
    await prisma.giveaway.create({
      data: {
        title: "Launch Giveaway",
        prize: 'Air Jordan 4 "Tour Yellow" (winner\'s size)',
        description:
          "Deadstock pair of September's first-ever Tour Yellow retro. Ships free in the continental US.",
        endsAt: new Date(now + 30 * DAY),
      },
    });
  }

  console.log(
    `Seeded ${submissions.length} submissions, ${battles.length} battles, ${products.length} products, ${articles.length} articles, ${questions.length} quiz questions.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Seeds demo submissions, battles, votes, the affiliate shop, the
// trivia question bank (prisma/questions.json), and a demo giveaway.
// Run with: npm run db:seed  (safe to re-run — it wipes and reseeds
// demo content; it does NOT touch user accounts)
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { drops2026 } from "./seed-drops-2026.mjs";
import { marketSlate } from "./seed-products.mjs";

const prisma = new PrismaClient();
const here = path.dirname(fileURLToPath(import.meta.url));

const DAY = 24 * 60 * 60 * 1000;

const submissions = [
  {
    key: "toxic",
    title: "Toxic Drip AF1",
    artistName: "Krylon Kelz",
    socialHandle: "krylonkelz",
    email: "demo+kelz@theheatchart.example",
    baseShoe: "Nike Air Force 1",
    brand: "Nike",
    silhouette: "Air Force 1",
    baseColorway: "Triple White",
    description:
      "Angelus neon set over a blacked-out base, drip effect done freehand, finished with matte acrylic sealer.",
    imageUrl: "/seed/custom-1.svg",
  },
  {
    key: "molten",
    title: "Molten Lava Dunk",
    artistName: "SoleFire Studio",
    socialHandle: "solefirestudio",
    email: "demo+solefire@theheatchart.example",
    baseShoe: "Nike Dunk Low",
    brand: "Nike",
    silhouette: "Nike Dunk",
    baseColorway: "Panda",
    description:
      "Heat-map fade from the sole up, hand-painted crackle texture, custom red laces with brass aglets.",
    imageUrl: "/seed/custom-2.svg",
  },
  {
    key: "frost",
    title: "Frostbite 990s",
    artistName: "IceBox Customs",
    socialHandle: "iceboxcustoms",
    email: "demo+icebox@theheatchart.example",
    baseShoe: "New Balance 990v6",
    brand: "New Balance",
    silhouette: "990v6",
    baseColorway: "Castlerock Grey",
    description: "Icy translucent midsole swap, arctic gradient suede dye, reflective stitching.",
    imageUrl: "/seed/custom-3.svg",
  },
  {
    key: "neon",
    title: "Neon Riot AJ1",
    artistName: "Riot Grrl Kicks",
    socialHandle: "riotgrrlkicks",
    email: "demo+riot@theheatchart.example",
    baseShoe: "Air Jordan 1 High",
    brand: "Jordan",
    silhouette: "Air Jordan 1",
    baseColorway: "White/Black",
    description: "UV-reactive pink panels, hand-cut stencil graffiti, glow-in-the-dark outsole.",
    imageUrl: "/seed/custom-4.svg",
  },
  {
    key: "gold",
    title: "24K Court Kings",
    artistName: "Midas Touch",
    socialHandle: "midastouchcustoms",
    email: "demo+midas@theheatchart.example",
    baseShoe: "Air Jordan 4",
    brand: "Jordan",
    silhouette: "Air Jordan 4",
    baseColorway: "White Cement",
    description: "Gold-leaf wings, tonal cream base, aged lace tips for the vintage grail look.",
    imageUrl: "/seed/custom-5.svg",
  },
  {
    key: "galaxy",
    title: "Galaxy Foam Runners",
    artistName: "Nebula Lab",
    socialHandle: "nebulalab",
    email: "demo+nebula@theheatchart.example",
    baseShoe: "Yeezy Foam Runner",
    brand: "adidas",
    silhouette: "Yeezy Foam Runner",
    baseColorway: "Ararat",
    description: "Hydro-dipped nebula wash, airbrushed star field, pearlescent top coat.",
    imageUrl: "/seed/custom-6.svg",
  },
  {
    key: "venom",
    title: "Venom Strike SB",
    artistName: "Krylon Kelz",
    socialHandle: "krylonkelz",
    email: "demo+kelz@theheatchart.example",
    baseShoe: "Nike SB Dunk",
    brand: "Nike",
    silhouette: "Nike SB Dunk",
    baseColorway: "Blackout",
    description: "Scale texture carved into the leather, venom-green fade, custom snake-eye dubraes.",
    imageUrl: "/seed/custom-7.svg",
  },
  {
    key: "bred",
    title: "Bred Heat 11s",
    artistName: "SoleFire Studio",
    socialHandle: "solefirestudio",
    email: "demo+solefire@theheatchart.example",
    baseShoe: "Air Jordan 11",
    brand: "Jordan",
    silhouette: "Air Jordan 11",
    baseColorway: "Bred",
    description: "Patent leather re-dye, ember airbrush on the mudguard, red translucent sole swap.",
    imageUrl: "/seed/custom-8.svg",
  },
];

// The Market's curated slate lives in seed-products.mjs. Products top
// up by slug on deploy (create-only — /admin edits always win). The
// names below are the retired pre-slug starter set: launch seeding
// clears them once so the curated slate replaces them cleanly. The
// shop was never public while they existed, and admin-created products
// (different names, no slug) are never touched.
const products = marketSlate;
const retiredStarterNames = [
  "Hyped + Rare Pairs", "Authenticated Grails", "Rare Sneaker Vault",
  "Region-Exclusive Drops", "New Release Wall", "Hype Drops + Exclusives",
  "Boutique Launches", "Nike By You Customs", "Leather Paint Starter Kit",
  "Neon Collection Paints", "Finisher + Sealer Range", "Signature Cleaning Kit",
  "Rain & Stain Spray", "Premium Shoe Cleaner", "Premium Rope Laces",
  "Crease Protectors", "Sneaker Display Cases", "Cedar Shoe Trees",
];

// Drop Report seed articles. Release info researched July 2026 from
// sneaker release calendars (Sole Retriever, Sneaker Bar Detroit, Nice
// Kicks, Sneaker News, House of Heat) — dates shift, re-verify before
// promoting a post.
const articles = [
  {
    slug: "air-jordan-4-laser-pack-2027-release-date",
    title: "Air Jordan 4 'Laser' Pack Returns February 2027 — Both 2005 Grails, One $500 Box",
    excerpt:
      "Jordan Brand is bringing the laser-etched 2005 duo back: the 'White Laser' and 'Black Laser' AJ4s return together as a $500 two-pair pack in February 2027, in a Michael Jordan face box.",
    tags: "Jordan, Release Dates, Packs",
    coverImage: "/seed/aj4-laser-pack-2027.jpeg",
    sku: "IR2070-100",
    raffleUrl: "https://www.nike.com/launch",
    daysAgo: 0,
    question: {
      q: "Who created the laser-etched artwork on the original 2005 Air Jordan 4 'Laser'?",
      options: ["Tinker Hatfield", "Mark Smith", "Peter Moore", "Virgil Abloh"],
      answer: 1,
      explain: "Nike designer Mark Smith pioneered the laser-etching project; Tinker Hatfield designed the original AJ4 silhouette itself.",
    },
    content: [
      "## The drop",
      "",
      "Jordan Brand is reviving one of the most coveted 4s ever made. The **Air Jordan 4 'Laser' Pack** is expected **February 2027** — the **'White Laser' and 'Black Laser' together in one two-pair set for $500**, reportedly packaged in a **Michael Jordan face box**. It's the first true return of the 2005 duo, and early word is quantities will be very limited.",
      "",
      "## Why these two matter",
      "",
      "The originals dropped in 2005 for the Air Jordan line's **20th anniversary**, with laser-etched artwork burned across the uppers — a technique Nike designer **Mark Smith** pioneered, tying the 4 into the storytelling language of the Air Jordan XX. The **White Laser** runs a white leather base with Fire Red-style blocking, black accents, and etched graphics head to toe. The **Black Laser** flips it: black leather, red laces and lining, grey heel and midsole hits, and light green eyelets. The 2005 'Black Laser' in particular barely released at all — it's been a grail for twenty years.",
      "",
      "## The details",
      "",
      "- **What:** Air Jordan 4 'Laser' Pack — 'White Laser' + 'Black Laser'",
      "- **When:** expected February 2027 (exact date not yet confirmed)",
      "- **Price:** $500 for the two-pair pack",
      "- **Style codes:** IR2070-100 (White) / IR2070-001 (Black)",
      "- **Extras:** Michael Jordan face box; updated AJ4 fit is reported",
      "",
      "We'll pin the exact date on the calendar the moment it firms up — check the drop sheet below for where to buy and set your reminder.",
      "",
      "*Photo via @xcverum on IG.*",
    ].join("\n"),
  },
  // The rest-of-2026 drop slate — one article per release, each with a
  // culture question (see seed-drops-2026.mjs).
  ...drops2026,
  {
    slug: "air-jordan-4-tour-yellow-release-date-2026",
    title: "Air Jordan 4 'Tour Yellow' Release Date: The 20-Year Wait Ends September 5",
    excerpt:
      "The Air Jordan 4 'Tour Yellow' finally retros September 5, 2026 for $220 (IO2463-102). Release info, where to cop, and why this one will not sit.",
    tags: "Jordan, Release Dates, SNKRS",
    coverImage: "/seed/news-1.svg",
    daysAgo: 1,
    dropAt: new Date("2026-09-05T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    question: {
      q: "Peel back the Velcro tongue patch on the original 2006 'Tour Yellow' AJ4 — what branding was hidden underneath?",
      options: ["Nike Air", "Rare Air", "Jordan Flight", "Tuned Air"],
      answer: 1,
      explain: "It was just the second AJ4 with the removable patch revealing 'Rare Air,' after the 2005 Undefeated x AJ4 introduced the concept.",
    },
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
      "## The deep cuts",
      "",
      "- The original dropped May 20, 2006 as the Air Jordan 4 Retro LS 'Tour Yellow' (314254-171) at $125 — the 2026 drop is its first retro ever, 20 years later.",
      "- It was only the second AJ4 to hide 'Rare Air' branding under a removable Velcro tongue patch, a concept introduced on the 2005 Undefeated x Air Jordan 4.",
      "- The 2026 numbers are locked: September 5, 2026, $220, IO2463-102, White/Tour Yellow-Dark Blue Grey-Black, with the Tour Yellow riding a speckled cement-effect midsole.",
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
    dropAt: new Date("2026-10-10T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    question: {
      q: "What was the collector complaint about the 2017 'Royal' that the 2026 retro was built to fix?",
      options: [
        "It used tumbled leather instead of smooth 1985-style leather",
        "It swapped the Nike Air heel for a Jumpman",
        "It only released in a mid cut",
        "It reversed the black/royal blocking",
      ],
      answer: 0,
      explain: "The 2017 pair's tumbled leather drew years of criticism; the 2026 release returns to smooth leather closer to the 1985 original.",
    },
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
      "## The deep cuts",
      "",
      "- The 2017 Royal (555088-007) dropped April 1, 2017 at $160 in tumbled leather — the exact gripe this 2026 pair answers.",
      "- 2026 is only the fourth High OG release of the Royal in 40-plus years: 1985, 2013, 2017, 2026.",
      "- This one uses the standard High OG cut, not the more limited '85 shape.",
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
    dropAt: new Date("2026-08-08T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    question: {
      q: "What did the original 2010 Air Jordan 6 'Oreo' retail for on release day?",
      options: ["$125", "$135", "$150", "$175"],
      answer: 2,
      explain: "The March 20, 2010 release (384664-101) retailed at $150 — and never returned until the 2026 retro.",
    },
    content: [
      "## The drop at a glance",
      "",
      "| | |",
      "|---|---|",
      "| **Release date** | August 8, 2026 |",
      "| **Retail price** | $215 |",
      "| **Style code** | CT8529-108 |",
      "| **Colorway** | Black / White — black nubuck and suede base, white tumbled leather overlays |",
      "| **Where** | Nike.com / SNKRS, Finish Line, Foot Locker, JD Sports, Hibbett |",
      "",
      "## 16 years is a long time",
      "",
      "The 'Oreo' 6 last released in **2010**, and this return stays true to the original blocking — a black nubuck and suede base with white tumbled leather overlays doing the cream work, the same way the 2010 pair wore it. Long-dormant colorways carry real nostalgia demand: people who missed it as teenagers now have adult money.",
      "",
      "Expect a fast sell-through. Wide sizing helps your odds, but do not sleep on release morning.",
      "",
      "## The deep cuts",
      "",
      "- The original 'Oreo' 6 (384664-101) dropped March 20, 2010 at $150 — its only run before 2026.",
      "- The 2026 retro comes in full family sizing: $215 men, $155 GS, $95 PS, $80 toddler.",
      "- The speckle isn't just underfoot — it hits the black midsole, the lace lock, and the heel tab.",
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
    question: {
      q: "The 2022 Reverse Mocha Low set the all-time SNKRS record — how many draw entries did Nike report?",
      options: ["1.2 million", "2.4 million", "3.8 million", "5.6 million"],
      answer: 2,
      explain: "Nike reported 3.8 million SNKRS entries, the most ever; 2.4 million was the 30-minute travisscott.com presale figure.",
    },
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
      "## The deep cuts",
      "",
      "- The 2022 Reverse Mocha Low (DM7866-162) dropped July 21, 2022 at $150 and set the all-time SNKRS record: 3.8 million entries for roughly 60,000 pairs — about a 1.5% win rate.",
      "- Before SNKRS even opened, the travisscott.com presale pulled 2.4 million entries in about 30 minutes.",
      "- The High inverts the 2019 'Mocha' (CD4487-100) blocking: white tumbled leather base, brown suede overlays, black reverse Swoosh, sail midsole.",
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
      "The full August 2026 sneaker release calendar — Jordan 1 'Love Letter', Flint 13s, Oreo 6s, the Kobe 'Halo' birthday drop, and the Space Jam 9s, with dates and prices.",
    tags: "Release Dates, Calendar, SNKRS",
    coverImage: "/seed/news-5.svg",
    daysAgo: 0,
    question: {
      q: "Nike's official 'Mamba Day' drops land on April 13 every year — what does that date mark?",
      options: [
        "Kobe's birthday",
        "His 81-point game",
        "The 8/24 jersey retirement",
        "His 60-point final NBA game on April 13, 2016",
      ],
      answer: 3,
      explain: "Mamba Day commemorates Kobe's 60-point farewell against Utah on April 13, 2016; his birthday is Aug 23 and Kobe Bryant Day is 8/24.",
    },
    content: [
      "## The calendar",
      "",
      "| Date | Release | Price |",
      "|---|---|---|",
      "| Aug 1 | Air Jordan 1 High OG 'Love Letter' (DZ5485-201) | $185 |",
      "| Aug 1 | Air Jordan 13 Retro 'Flint' (IW3808-400) | $215 |",
      "| Aug 8 | Air Jordan 6 'Oreo' (CT8529-108) | $215 |",
      "| Aug 8 → Sep 19 (delayed) | Nike Kobe 8 Protro 'Mambacurial' | $200 |",
      "| Aug 15 → Sep 8 (moved) | Nike Kobe 5 Protro 'Dodgers' | $190 |",
      "| Aug 23 | Kobe 10 Elite Low Protro 'Halo' (Kobe's birthday) | TBC |",
      "| Aug 29 | Air Jordan 9 Retro OG 'Space Jam' (HV4794-106) | $215 |",
      "",
      "## The ones to actually chase",
      "",
      "**Jordan 1 'Love Letter' (Aug 1)** — a tribute to MJ's 2003 farewell letter to basketball. The letter itself isn't printed on the shoe; his sign-off, 'Much Love and Respect,' is debossed on the inner ankle flap, with a leather hangtag to match. Story pairs like this age well.",
      "",
      "**Jordan 6 'Oreo' (Aug 8)** — first return in 16 years. [Full breakdown here](/news/air-jordan-6-oreo-2026-release-date).",
      "",
      "**The Kobe slate** — August thinned out late: the 8 'Mambacurial' slid to September 19 (the $200 tag holds) and the 5 'Dodgers' moved to September 8, leaving the 10 Elite Low 'Halo' to carry the month on August 23 — Kobe's birthday, his would-be 48th. Don't call it Mamba Day: Nike runs that on April 13, and Kobe Bryant Day is 8/24. Kobe releases are still the hardest wins on SNKRS; enter everything.",
      "",
      "**Space Jam 9s (Aug 29)** — timed to the movie's 30th anniversary with OG-style packaging and shaping closer to the 1993 original.",
      "",
      "## The deep cuts",
      "",
      "- The Kobe 11 EM Protro 'Mamba Day' dropped April 13, 2026 — Nike anchors Mamba Day to the anniversary of Kobe's 60-point final game, April 13, 2016.",
      "- The all-white 'Halo' tribute series has run yearly since the Kobe 8 Protro 'Halo' in 2023, working through both Kobe 9 builds on its way to the 10.",
      "- Aug 1 is a double-header — Flint 13 (IW3808-400, $215) and Love Letter 1 (DZ5485-201, $185) drop together — with the Oreo 6 ($215) on Aug 8 and the Space Jam 9 (HV4794-106, $215) closing the month Aug 29.",
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
  {
    slug: "air-jordan-4-birds-of-paradise-release-date",
    title: "Air Jordan 4 'Birds of Paradise' Drops July 23 — The Summer's Prettiest 4",
    excerpt:
      "The women's Air Jordan 4 'Birds of Paradise' releases July 23, 2026 for $220 — Coconut Milk, Bright Mango, and Muslin. Release info and where to enter.",
    tags: "Jordan, Release Dates, Womens",
    coverImage: "/seed/drop-1.svg",
    dropAt: new Date("2026-07-23T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    daysAgo: 0,
    question: {
      q: "What is Nike's official name for the creamy off-white leather base on the 'Birds of Paradise' 4?",
      options: ["Sail", "Summit White", "Phantom", "Coconut Milk"],
      answer: 3,
      explain: "The SNKRS listing is officially 'Coconut Milk and Bright Mango' (HV0823-101).",
    },
    content: [
      "## The drop",
      "",
      "The **Air Jordan 4 'Birds of Paradise'** lands **Thursday, July 23, 2026** for **$220** as a women's exclusive. The blocking is Coconut Milk leather over Bright Mango hits with a Muslin midsole — the rare 4 that reads soft instead of loud, and it photographs beautifully.",
      "",
      "## The deep cuts",
      "",
      "- The official colorway (HV0823-101) runs Coconut Milk/Metallic Gold-Muslin-Bright Mango-Sundial-Black — SNKRS lists it simply as 'Coconut Milk and Bright Mango.'",
      "- The color story lives underfoot: a semi-translucent gradient outsole fades Bright Mango through Sundial into navy, with translucent TPU wings and eyestays softening the build.",
      "- The namesake bird of paradise flower — Strelitzia — is native to South Africa.",
      "",
      "## How to cop",
      "",
      "1. **SNKRS** at 10 AM ET — set the notification now.",
      "2. **Retailer raffles** — women's-exclusive 4s often sit a touch longer than the men's hype pairs, so in-store lists are a real path.",
      "3. Sizing note: this runs women's sizing — men, convert UP 1.5 (a men's 9 wears a women's 10.5 in Nike sizing) and hunt the larger end of the run.",
      "",
      "## The customizer angle",
      "",
      "That cream-and-mango canvas is begging for hand-painted detail work. If you flip a pair, [get it on The Heat Chart](/submit) — summer pastel customs are undefeated on the timeline.",
      "",
      "*Dates shift — check the [Drop Calendar](/drops) before you camp.*",
    ].join("\n"),
  },
  {
    slug: "air-jordan-8-bin-23-release-date",
    title: "Air Jordan 8 'BIN 23' Drops August 15 at $355 — 2026's Third BIN Release",
    excerpt:
      "The Air Jordan 8 'BIN 23' releases August 15, 2026 for $355 in Legion Pine and red — the third BIN 23 drop of the year, with luxury materials and numbered pairs.",
    tags: "Jordan, Release Dates, Grails",
    coverImage: "/seed/drop-2.svg",
    dropAt: new Date("2026-08-15T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    daysAgo: 0,
    question: {
      q: "How many pairs of the Air Jordan 8 'BIN 23' are being produced?",
      options: ["1,985 pairs", "2,300 pairs", "8,000 pairs", "23,000 pairs"],
      answer: 1,
      explain: "Production is capped at 2,300 individually numbered pairs, echoing the BIN 23 name.",
    },
    content: [
      "## The drop",
      "",
      "**BIN 23 rolls on.** The premium line that gives grails the luxury treatment lands on the **Air Jordan 8** — the third BIN 23 drop of 2026, after the AJ3 and AJ6 earlier this year — arriving **Saturday, August 15, 2026** at **$355**. Legion Pine nubuck, deep red accents, upgraded materials throughout — this is the 8 built like a dress shoe.",
      "",
      "## Why it matters",
      "",
      "BIN pairs are produced in tighter numbers than general releases and historically hold resale value better than almost any non-collab retro. If you're buying one pair this month as an investment piece, this is the conversation.",
      "",
      "## The deep cuts",
      "",
      "- Limited to 2,300 individually numbered pairs — a nod to the BIN '23' name (style code IO2053-300).",
      "- The extras run deep: a red wax '23' seal on the left tongue, wooden shoe trees, dust bags, a retro card, and a green pull-out box.",
      "- It sells through SNKRS and Tier-0/select Jordan stockists, dressed in tonal Legion Pine nubuck and suede.",
      "",
      "## How to cop",
      "",
      "1. **SNKRS** — expect an exclusive-access wave to eat some stock.",
      "2. Boutique accounts (the premium tier usually hits select doors, not every mall retailer).",
      "",
      "## The collector angle",
      "",
      "A $355 retail with 2,300 numbered pairs is exactly the kind of piece our [Market](/market) exists for — record the sale with a receipt and the ✓ travels with the shoe forever.",
      "",
      "*Dates shift — check the [Drop Calendar](/drops) before you camp.*",
    ].join("\n"),
  },
  {
    slug: "air-jordan-4-comic-release-date",
    title: "Air Jordan 4 'Comic' Release Date: July 25 for $230 — Fire Pink Ink Lines",
    excerpt:
      "The Air Jordan 4 'Comic' drops July 25, 2026 for $230 — Off White leather with Anthracite and Fire Pink comic-book detailing. Full release info inside.",
    tags: "Jordan, Release Dates, SNKRS",
    coverImage: "/seed/drop-3.svg",
    dropAt: new Date("2026-07-25T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    daysAgo: 0,
    question: {
      q: "The AJ4 'Comic' pulls its ink-line artwork from which piece of MJ history?",
      options: [
        "Space Jam animation storyboards",
        "His 1985 comic-style Nike 'Dunk' T-shirt",
        "A 1996 SLAM magazine cover",
        "His Wheaties box illustration",
      ],
      answer: 1,
      explain: "Jordan Brand lifted the graphic language from the 1985 comic-themed Nike tee of MJ dunking, not from any film or magazine art.",
    },
    content: [
      "## The drop",
      "",
      "The **Air Jordan 4 'Comic'** hits **Saturday, July 25, 2026** for **$230** — Off White base, Anthracite structure, and Fire Pink hits with comic-book ink detailing on the panels. It's the loudest 4 of the summer and the one your feed will not shut up about.",
      "",
      "## The deep cuts",
      "",
      "- The artwork traces to MJ's 1985 comic-style Nike 'Dunk' T-shirt — Michael soaring for a dunk in comic-book linework.",
      "- Comic-book 'POW!'-style graphics hit the panels, and the Nike Air heel branding is redrawn in a vintage comic font with a pixelated gradient.",
      "- Full family sizing: $230 adult, $165 GS, $105 PS, $90 TD — retailers list it under JA1135-100, some under IO2362-100.",
      "",
      "## How to cop",
      "",
      "1. **SNKRS**, Saturday 10 AM ET — Saturday drops move fast.",
      "2. **Retailer raffles** open midweek at most accounts — enter every one.",
      "3. Miss it? It'll be on the marketplaces above retail within the hour — check the [Shop](/shop) for the ones we trust.",
      "",
      "## The customizer angle",
      "",
      "A shoe that already looks drawn-on is an open invitation. Custom ink work over the Comic panels is a wave waiting for a first mover — [claim it in the arena](/submit).",
      "",
      "*Dates shift — check the [Drop Calendar](/drops) before you camp.*",
    ].join("\n"),
  },
  {
    slug: "august-1-flint-13-love-letter-1-double-release",
    title: "August 1 Double-Up: Flint 13s and Jordan 1 'Love Letter' Drop the Same Morning",
    excerpt:
      "August 1, 2026 is a two-grail morning: the Air Jordan 13 'Flint' ($215) and Air Jordan 1 High OG 'Love Letter' ($185) drop together. Game plan inside.",
    tags: "Jordan, Release Dates, SNKRS",
    coverImage: "/seed/drop-4.svg",
    dropAt: new Date("2026-08-01T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    daysAgo: 0,
    question: {
      q: "The 'Love Letter' AJ1 carries the phrase MJ used to sign his 2003 farewell letter — what's debossed on the inner ankle flap?",
      options: ["'I'm Back'", "'Love of the Game'", "'Much Love and Respect'", "'Forever, Michael'"],
      answer: 2,
      explain: "MJ closed his 2003 open letter to basketball with 'Much Love and Respect,' and Jordan Brand debossed it into the ankle flap.",
    },
    content: [
      "## Two grails, one morning",
      "",
      "**Saturday, August 1, 2026** is the deepest morning of the summer: the **Air Jordan 13 'Flint'** returns in Navy/Flint Grey/University Blue at **$215**, and the **Air Jordan 1 High OG 'Love Letter'** drops in Shadow Brown and Team Red at **$185**.",
      "",
      "## The deep cuts",
      "",
      "- The Flint 13 last retroed May 30, 2020 at $190 (414571-404) in the same Navy/Flint Grey/University Blue blocking.",
      "- The Love Letter honors MJ's 2003 farewell — an open letter to basketball that ran in Sunday newspapers four days after his final NBA game, signed 'Much Love and Respect.'",
      "- That sign-off is debossed on the Love Letter's inner ankle flap and repeated on a basketball-shaped leather hangtag.",
      "",
      "## The game plan",
      "",
      "1. You get one SNKRS entry per drop — enter **both**, prioritize the pair you'd actually wear.",
      "2. The Flint 13 is the nostalgia pick (first retro in years); the Love Letter 1 is the fit-versatility pick.",
      "3. Retailer raffles run separately from SNKRS — that's a second and third bite at each.",
      "",
      "## Our call",
      "",
      "Flint 13s sell out slower but hold value steadier; Love Letter 1s evaporate at 10:01. If you can only camp one, camp the 1.",
      "",
      "*Dates shift — check the [Drop Calendar](/drops) before you camp.*",
    ].join("\n"),
  },
  {
    slug: "nike-kobe-5-protro-dodgers-release-date",
    title: "Nike Kobe 5 Protro 'Dodgers' (IO6256-400): Release Date, Price & the Full Story",
    excerpt:
      "Everything on the Nike Kobe 5 Protro 'Dodgers' — the September 8, 2026 release date, $190 price, style code IO6256-400, Rush Blue with red baseball stitching — plus the whole lineage: the Kobe 6 'Dodgers' that began as Vanessa Bryant's player exclusive and debuted on the mound at Dodger Stadium.",
    tags: "Kobe, Release Dates, SNKRS, Dodgers",
    coverImage: "/seed/kb6d-1.webp",
    dropAt: new Date("2026-09-08T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    daysAgo: 0,
    question: {
      q: "When Natalia Bryant debuted the Kobe 6 'Dodgers' with the first pitch on Lakers Night 2023, which Dodgers All-Star caught it?",
      options: ["Clayton Kershaw", "Freddie Freeman", "Will Smith", "Mookie Betts"],
      answer: 3,
      explain: "Mookie Betts handled catching duties that night — the toss took one bounce before landing in his glove.",
    },
    content: [
      "## Quick facts",
      "",
      "| | |",
      "| --- | --- |",
      "| **Shoe** | Nike Kobe 5 Protro 'Dodgers' |",
      "| **Style code** | IO6256-400 |",
      "| **Colorway** | Rush Blue / Wolf Grey / Comet Red |",
      "| **Price** | $190 |",
      "| **Release date** | September 8, 2026 (moved off an earlier August 15 placeholder — see below) |",
      "| **Where** | SNKRS + select Nike Basketball retailers |",
      "",
      "## When does the Kobe 5 Protro 'Dodgers' drop?",
      "",
      "The current consensus across the majors — Sneaker News, Sneaker Files, Sole Retriever — has the **Kobe 5 Protro 'Dodgers'** landing **Tuesday, September 8, 2026 for $190**. The August 15 date you may have seen earlier was a placeholder that has since been scrubbed. Kobe dates move more than any line Nike runs, so treat September 8 as the target and check back the week of. Either way it sits in a loaded stretch: the 10 Elite Low 'Halo' drops August 23 — Kobe's birthday, not Mamba Day, which Nike runs on April 13 — and the 8 'Mambacurial', delayed off its original August date, follows on September 19.",
      "",
      "## The design: Dodger blue, snakeskin, baseball stitching",
      "",
      "Rush Blue over the 5's low-cut shell with **snakeskin texturing** in the Mamba tradition, Wolf Grey accents, and **Comet Red baseball stitching that wraps the heel** — the clearest Dodgers signal on the shoe, and a deliberate echo of the pair that started all this. No jersey patches, no billboard branding: the theme rides in the materials.",
      "",
      "## The story: it started with Vanessa Bryant's player exclusive",
      "",
      "The Dodgers-Kobe lineage begins with the **Kobe 6 Protro 'Dodgers' (CW2190-400)** — originally created as a **player exclusive for Vanessa Bryant**. The world met it when **Natalia Bryant wore the pair to throw a ceremonial first pitch at Dodger Stadium**, and the PE instantly became one of the most hunted Kobes on the resale market.",
      "",
      "![Nike Kobe 6 Protro 'Dodgers' CW2190-400 — Game Royal snakeskin upper, white swoosh, the pair that started the lineage](/seed/kb6d-1.webp)",
      "",
      "Demand won: Nike gave the 6 'Dodgers' a retail run — an early **UNDEFEATED release in LA and Tokyo on March 15**, then a **global SNKRS drop on May 30** at select retailers. It sold through instantly and settled in as one of the most beloved Kobe 6 makeups ever — which is exactly why the 5 is getting the Dodger treatment now.",
      "",
      "![Baseball-seam stitching in University Red across the Kobe 6 'Dodgers' tongue](/seed/kb6d-2.webp)",
      "",
      "## The details that made the 6 'Dodgers' a grail",
      "",
      "**Jersey-style red 8s** on the heels. **Kobe's signature in red** across the heel counter. **Baseball-seam stitching** over the tongue. Game Royal scales head to toe over a white midsole. Every Dodgers cue earned its place without a single logo shouting.",
      "",
      "![The red jersey-style 8 on the Kobe 6 'Dodgers' heel](/seed/kb6d-3.webp)",
      "",
      "![Kobe's signature in red across both heels](/seed/kb6d-4.webp)",
      "",
      "## Kobe and the Dodgers",
      "",
      "Kobe was an LA institution across every code the city plays — courtside at Staples, in the stands at Chavez Ravine. The Dodgers honored him after his passing, and the 8/24 numbers still ring around both franchises every Kobe Bryant Day, August 24. A Dodger-blue Kobe isn't a novelty colorway; it's a city handshake.",
      "",
      "![Full-length Game Royal outsole with the sheath logo under the Kobe 6 'Dodgers'](/seed/kb6d-5.webp)",
      "",
      "## The deep cuts",
      "",
      "- The Kobe 6 'Dodgers' (CW2190-400) wide release was itself delayed — from Mamba Day, April 13, 2025 to May 30, 2025 — after UNDEFEATED broke it early on March 15, 2025 at its La Brea and Shibuya doors.",
      "- Natalia Bryant debuted the PE throwing the ceremonial first pitch on Lakers Night at Dodger Stadium, September 1, 2023 — Kobe himself threw a Dodgers first pitch back in 2000.",
      "- The Kobe 5 'Dodgers' hides 8 and 24 on the inner tongue in old-TV-style graphics, with a silver white-outlined Swoosh and red baseball stitching at the heel.",
      "",
      "## How to actually get a pair",
      "",
      "1. **SNKRS, 10 AM ET** on release day — pure draw, enter from every account in the household.",
      "2. **House of Hoops / Foot Locker app raffles** typically open the week prior.",
      "3. Watch **UNDEFEATED and boutique Nike Basketball accounts** — the 6 'Dodgers' proved this line gets boutique-first treatment.",
      "4. Miss it? The 8 'Mambacurial' (delayed to September 19) cools off faster if you just want Mamba energy on foot.",
      "",
      "## FAQ",
      "",
      "**Is the 'Dodgers' a Kobe 5 or a Kobe 6?** Both exist. The **6** (CW2190-400) was the original — Vanessa Bryant's PE turned retail release. The **5** (IO6256-400) is the 2026 follow-up covered here.",
      "",
      "**What did the Kobe 6 'Dodgers' retail for?** $190 at retail ($120 GS); resale ran multiples of that from day one.",
      "",
      "**Will the Kobe 5 'Dodgers' restock?** Kobe Protros rarely restock meaningfully — treat launch day as the day.",
      "",
      "*Dates shift — check the [Drop Calendar](/drops) before you camp.*",
    ].join("\n"),
  },
  {
    slug: "air-jordan-9-og-space-jam-release-date",
    title: "Air Jordan 9 OG 'Space Jam' Returns August 29 — Anniversary Box, Full Details",
    excerpt:
      "The Air Jordan 9 OG 'Space Jam' (HV4794-106) drops August 29, 2026 for $215 with 30th-anniversary packaging and 1993-accurate shaping. The complete story inside.",
    tags: "Jordan, Release Dates, Grails, Space Jam",
    coverImage: "/seed/spacejam9-pack.jpg",
    dropAt: new Date("2026-08-29T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    daysAgo: 0,
    question: {
      q: "In 2008 the White/True Red Jordan 9 returned as half of a Countdown Pack — which Air Jordan shared the box?",
      options: ["Air Jordan 11", "Air Jordan 13", "Air Jordan 14", "Air Jordan 7"],
      answer: 2,
      explain: "Countdown Packs paired models whose numbers summed to 23, so the 9 was boxed with the 14.",
    },
    content: [
      "## The drop",
      "",
      "The **Air Jordan 9 OG 'Space Jam'** releases **Saturday, August 29, 2026** for **$215** under style code **HV4794-106**. The blocking is the one the culture knows by heart: white leather base, black nubuck mudguard sweeping up into the collar, True Red hits on the tongue branding, the heel's globe emblem, and red Jumpmans under the outsole. The **OG** tag is earned — this pair returns with **shaping corrected to the 1993 original**, part of Jordan Brand's push for historical accuracy.",
      "",
      "![Air Jordan 9 OG Space Jam — pair](/seed/spacejam9-pair.jpg)",
      "",
      "## The anniversary box",
      "",
      "This isn't a standard-box release. **Space Jam hit theaters November 15, 1996** — thirty years ago this fall — and the 9 comes wrapped for the occasion: reports point to **custom packaging styled after the classic 1993 OG 'MJ face' box**, honoring the crossover that united Michael Jordan and Bugs Bunny, with both the AJ9 and AJ11 featured on screen. Nike hasn't detailed every flourish yet, but collectors: the box is part of the grail this time. Keep it clean.",
      "",
      "![The 30th-anniversary Space Jam packaging](/seed/spacejam9-box.jpg)",
      "",
      "## The history — the Jordan MJ never wore in an NBA game",
      "",
      "Tinker Hatfield designed the 9 for a season that never happened. It released in **November 1993 at $125** — weeks after MJ walked away from basketball to play minor-league baseball — and MJ never wore the 9 in an NBA game; it launched into the void of his first retirement, a distinction it shares with the AJ15. (The closest it ever came: a 2002 Wizards preseason cameo in the 'Cool Grey' retro — but preseason isn't the show.) Hatfield leaned into the moment: a minimalist upper, a one-pull lacing system, the lightest Jordan yet, and an outsole ringed with words in **Japanese, Swahili, Russian and more** — 'dedicated,' 'intense,' 'freedom' — a map of how far past basketball the man's reach had grown.",
      "",
      "And when Chicago raised **'The Spirit'** — the Jordan statue outside the United Center — on November 1, 1994, Hatfield put the 9 on its feet. It has stood in this shoe for three decades.",
      "",
      "## The retro record",
      "",
      "The White/Black-True Red 9 came back in **2002**, in the **2008 Countdown Pack**, in **2010**, and for the film's 20th anniversary on **December 3, 2016** — though Nike sold that pair officially as the Air Jordan 9 Retro OG 'White & Black' ($190, 302370-112); it never actually carried the 'Space Jam' name. The 2026 release is the first with **shaping corrected to the 1993 original** — and the first with the anniversary packaging.",
      "",
      "![On foot](/seed/spacejam9-onfoot.jpg)",
      "",
      "## The deep cuts",
      "",
      "- In the 2008 Countdown Pack the White/True Red 9 shared its box with the AJ14 — CDP pairings always summed to 23 (9 + 14).",
      "- The 'Spirit' statue outside the United Center went up November 1, 1994 with the AJ9 on its feet, and the OG outsole rings words like 'dedicated' and 'freedom' in multiple languages.",
      "- The 2026 pair (HV4794-106, $215, Aug 29) shares its HV4794 base code with 2025's Cool Grey retro.",
      "",
      "## How to cop",
      "",
      "1. **SNKRS**, Saturday, August 29 at 10 AM ET.",
      "2. **Select Jordan retailers** — raffles typically open the week prior; enter every one, because special-packaging stock at boutiques runs thinner than the SNKRS allocation.",
      "3. **Full family sizing is expected** — the twinning drop of the summer if you've got kids.",
      "4. Miss it? The 2016 pair has traded above retail for years, and the anniversary box adds collector premium this time — check the [Shop](/shop) for the marketplaces we trust.",
      "",
      "## The customizer angle",
      "",
      "White leather over black nubuck is the friendliest canvas in the entire Jordan line, and a Space Jam theme is begging for galaxy fades and Tune Squad linework. If you take a pair somewhere Jordan Brand never would, [put it in the arena](/submit) — the culture will tell you what it's worth.",
      "",
      "*Dates shift — check the [Drop Calendar](/drops) before you camp.*",
    ].join("\n"),
  },
];

// Launch roster — real artists pre-loaded through the seed so the
// league is never empty and no /admin work is needed. Claim emails are
// placeholders until each artist shares their real one; update the
// email here and the next deploy relinks their page to that account.
const preloadArtists = [
  {
    slug: "shoebaker",
    email: "claim.shoebaker@theheatchart.com",
    displayName: "Shoebaker",
    instagram: null,
    city: null,
    pieces: [
      {
        title: "Cotton Candy 11s",
        baseShoe: "Air Jordan 11",
        brand: "Jordan",
        silhouette: "Air Jordan 11",
        category: "sneakers",
        description:
          "Blacked-out patent and mesh with a cotton-candy melt — pink-to-blue gradient sole, liner, and lace loops.",
        imageUrl: "/seed/sb-cc-1.webp",
        extraImages: ["/seed/sb-cc-2.webp", "/seed/sb-cc-3.webp", "/seed/sb-cc-4.webp"],
      },
      {
        title: "Pineapple Under the Sea",
        baseShoe: "Air Jordan 11",
        brand: "Jordan",
        silhouette: "Air Jordan 11",
        category: "sneakers",
        description:
          "White knit upper over a pineapple-yellow patent mudguard, icy blue outsole — summer under the sea on a Jordan 11.",
        imageUrl: "/seed/sb-pine-1.webp",
        extraImages: ["/seed/sb-pine-2.webp", "/seed/sb-pine-3.webp", "/seed/sb-pine-4.webp", "/seed/sb-pine-5.webp"],
      },
      {
        title: "Patriot 1s",
        baseShoe: "Air Jordan 1 Mid",
        brand: "Jordan",
        silhouette: "Air Jordan 1 Mid",
        category: "sneakers",
        description:
          "Stars-and-stripes blocking over red, white, and navy panels — hand-detailed star fields on the toe and collar, finished with a gold USA lace charm.",
        imageUrl: "/seed/sb-usa-1.webp",
        extraImages: ["/seed/sb-usa-2.webp", "/seed/sb-usa-3.webp", "/seed/sb-usa-4.webp"],
      },
    ],
  },
  {
    // Miami — Javornie "JSB" Brathwaite (jsbthecreator.com, IG
    // @jsbthecreator, business email self-published on his contact
    // page). Slack corporate customs, a D-Wade retirement tribute,
    // and the Grails Miami x Mache Runner Art Basel commission. The
    // real email is set so his claimable account is already his.
    slug: "jsb-the-creator",
    email: "jsbthecreator@gmail.com",
    displayName: "JSB The Creator",
    instagram: "jsbthecreator",
    city: "Miami, FL",
    portfolioUrl: "https://jsbthecreator.com",
    bio: "Miami's Javornie 'JSB' Brathwaite — one-of-one wearable art across sneakers, jackets, canvas, and pants. The résumé runs from corporate one-offs for Slack to X-Men Jordan 3s, a Dwyane Wade retirement tribute, and an Art Basel commission from Grails Miami painted on Mache's own signature runner — approved by the legend himself.",
    pieces: [
      {
        title: "Welcome to Dade County",
        matchTitle: "dade",
        baseShoe: "Mache Runner",
        brand: "Mache",
        silhouette: "Mache Runner",
        category: "sneakers",
        description:
          "Commissioned by Grails, Miami's sneaker-themed sports bar, for an Art Basel event — painted on the Mache Runner, the signature shoe of customizing legend Mache, who saw the pair in person. The city rides every panel: Vice City-style artwork under a neon skyline, the Welcome to Dade County sign, Miami script across the heel, palm-tree charms and spiked studs over snakeskin texture, an “ART” midsole callout, and an orange drip outsole. One city, one shoe, one of one.",
        imageUrl: "/seed/jsb-dc-1.webp",
        extraImages: ["/seed/jsb-dc-2.webp", "/seed/jsb-dc-3.webp", "/seed/jsb-dc-4.webp"],
      },
    ],
  },
  {
    // Pueblo, CO — Gunnar Esquivel, 24 (FB 1.6K followers / 1.2K
    // posts, IG @Da_sneaker_customz_god). True small shop: no site,
    // no storefront, no public email anywhere — FB Messenger and IG
    // DMs are the only channels. Matt reached out on both 7/18.
    slug: "gunnar-esquivel",
    email: null,
    displayName: "Gunnar Esquivel",
    instagram: "Da_sneaker_customz_god",
    city: "Pueblo, CO",
    bio: "Pueblo, Colorado's Gunnar Esquivel — @Da_sneaker_customz_god — is a 24-year-old one-man shop with a fashion-house eye. The lane is material builds: luxury-monogram jacquard deconstructions strung with chunky rope laces and piercing hardware, streetwear-camo panel work, and player-exclusive Jordan 1 cleats. 'I make custom shoes.' The pairs say the rest.",
    pieces: [
      {
        title: "Bam Bam #42 Cleats",
        matchTitle: "bam bam",
        baseShoe: "Air Jordan 1 Cleat",
        brand: "Jordan",
        silhouette: "Air Jordan 1",
        category: "sneakers",
        description:
          "A player-exclusive build on the Air Jordan 1 cleat for a slugger who answers to Bam Bam — Taxi-style black, white, and yellow blocking, the Wings logo inked across the collar, and BAM BAM over #42 hand-painted on the heels. Custom number cleats made for the diamond, finished like a retro.",
        imageUrl: "/seed/ge-bb-3.webp",
        extraImages: ["/seed/ge-bb-4.webp", "/seed/ge-bb-1.webp", "/seed/ge-bb-2.webp"],
      },
      {
        title: "Pink Monogram Rope Forces",
        matchTitle: "monogram",
        baseShoe: "Nike Air Force 1",
        brand: "Nike",
        silhouette: "Air Force 1",
        baseColorway: "Triple White",
        category: "sneakers",
        description:
          "Dior-style oblique monogram jacquard in blush pink, cut and set into the Air Force 1's panels, then jewelry-finished — silver piercing rings and barbell hardware through the eyestays, chunky white rope laces over the top. Luxury-fashion materials rebuilt into a Force, with a body-mod edge.",
        imageUrl: "/seed/ge-dr-1.webp",
        extraImages: ["/seed/ge-dr-2.webp", "/seed/ge-dr-3.webp"],
      },
      {
        title: "Blue ABC Camo Forces",
        matchTitle: "abc camo",
        baseShoe: "Nike Air Force 1",
        brand: "Nike",
        silhouette: "Air Force 1",
        baseColorway: "Triple White",
        category: "sneakers",
        description:
          "BAPE-style blue ABC ape-head camo wrapped over the toe box, eyestay, and Swoosh, with a camo strip dropped under the Nike Air heel tab and chunky two-tone blue rope laces up top. Streetwear-grail fabric, panel-matched and stitched clean into a triple-white Force.",
        imageUrl: "/seed/ge-bp-2.webp",
        extraImages: ["/seed/ge-bp-3.webp", "/seed/ge-bp-4.webp", "/seed/ge-bp-1.webp"],
      },
    ],
  },
  {
    // San Diego triple threat — tattoos, sneaker customs, hand-tufted
    // rugs (IG @paint_the_skyred, ~2.8K). Matt has already reached
    // out; claimable placeholder until he takes the page.
    slug: "paint-the-skyred",
    email: null,
    displayName: "Paint The Sky Red",
    instagram: "paint_the_skyred",
    city: "San Diego, CA",
    bio: "San Diego creative working three canvases — tattoos, sneaker customs, and hand-tufted rugs. Energy flows where attention goes. Anime builds are the signature lane: One Piece Dunks, My Hero Academia Forces, and Afro Samurai Jordans, painted with a tattoo artist's linework.",
    pieces: [
      {
        title: "Afro Samurai Resurrection 1s",
        matchTitle: "afro samurai",
        baseShoe: "Air Jordan 1 Low",
        brand: "Jordan",
        silhouette: "Air Jordan 1 Low",
        category: "sneakers",
        description:
          "A hand-painted Afro Samurai: Resurrection build across black-patent Jordan 1 Lows. Afro stands in silhouette inside the crimson sun on one heel with his masked rival across the other, brushed kanji and AFRO SAMURAI lettering cut through the panels, blood-spatter rides the white leather and midsoles, and an icy translucent outsole closes it out. Comic panels on one shoe, title card on the other — a two-shoe episode.",
        imageUrl: "/seed/ps-as-1.webp",
        extraImages: ["/seed/ps-as-2.webp", "/seed/ps-as-3.webp", "/seed/ps-as-4.webp"],
      },
    ],
  },
  {
    // Atlanta concept artist — verified FB (4.8K), IG @dekota_customz,
    // commissions open. FB DMs are closed; IG is the channel.
    slug: "justin-dekota",
    email: null,
    displayName: "Justin Dekota",
    instagram: "dekota_customz",
    city: "Atlanta, GA",
    bio: "Atlanta sneaker artist bringing concepts to life — story builds with a message under the paint. KAWS-style characters, hand-lettered narratives, heels that read like panels. Commissions open.",
    pieces: [
      {
        title: "Treacherous Waters",
        matchTitle: "treacherous",
        baseShoe: "Nike Air Force 1",
        brand: "Nike",
        silhouette: "Air Force 1",
        baseColorway: "Triple White",
        category: "sneakers",
        description:
          "A KAWS-inspired plunge on the Air Force 1: purple fades into a teal undertow full of fish, bubbles, and circling sharks. XX marks over the toes, “Sink or Swim?” and “No Life Boat” hand-lettered along the midsoles, gloved KAWS hands and a Trap House scene at the heels, thrashed vintage tongues up top. Concept art with a current running underneath it.",
        imageUrl: "/seed/jd-tw-1.webp",
        extraImages: ["/seed/jd-tw-2.webp", "/seed/jd-tw-3.webp"],
      },
    ],
  },
  {
    // Verified heavyweight — 740K-follower FB page, IG @parksart,
    // YouTube/X/Threads/Etsy, Big Cartel shop. Self-listed in
    // Christiansburg, VA. Claimable placeholder; commissions run
    // through his DMs ("DM CUSTOMS").
    slug: "parksart",
    email: null,
    displayName: "Parksart Customs",
    instagram: "parksart",
    city: "Christiansburg, VA",
    portfolioUrl: "https://parksartcustoms.bigcartel.com",
    bio: "Hand-painted one-of-ones from a verified page 740K deep — custom sneakers, canvas work, and build content across every platform. The house style is layered airbrush color, abstract linework, and signature detailing. Commission books open monthly and fill fast: DM “CUSTOMS” to start a pair.",
    pieces: [
      {
        title: "Sunblush Levi's Jordan 4",
        matchTitle: "sunblush",
        baseShoe: "Air Jordan 4 x Levi's",
        brand: "Jordan",
        silhouette: "Air Jordan 4",
        baseColorway: "Levi's Denim",
        category: "sneakers",
        description:
          "Inspired by the friends-and-family Futura Sunblush Dunks, rebuilt to stand as its own piece — layered airbrush color washes over the Levi's denim Jordan 4, abstract orbit linework and signature scripts, a JG monogram at the heel, the red Levi's tab and Levi Strauss & Co. patch left untouched, paper-brown Jumpman tongue and gum sole closing it out. A grail donor turned wearable canvas.",
        imageUrl: "/seed/pa-sb-1.webp",
        extraImages: ["/seed/pa-sb-2.webp", "/seed/pa-sb-3.webp", "/seed/pa-sb-4.webp"],
      },
    ],
  },
  {
    // Facebook-only customizer, car-show scene — no site, no findable
    // IG/shop, DM-to-order. Bio built from their own brand language.
    // Self-published business phone from their promo posts:
    // 607-280-0362 (607 = south-central NY; "Crown City" is Cortland,
    // NY's nickname). Commissions from $250, 3–4 week turnaround.
    // Claimable placeholder until they take the page over.
    slug: "crown-city-kicks",
    email: null,
    displayName: "Crown City Kicks",
    instagram: null,
    city: null,
    bio: "Hand-built one pair at a time with the Crown City touch — from luxury velvet wraps to full movie-tribute story builds where every panel, lace tag, and insole carries a reference. Strict house rule: no duplicates, ever. Turns heads from the grocery store to the car show. Commissions run through the DMs. Built Different.",
    pieces: [
      {
        title: "The Sandlot AF1",
        matchTitle: "sandlot",
        baseShoe: "Nike Air Force 1",
        brand: "Nike",
        silhouette: "Air Force 1",
        baseColorway: "Triple White",
        category: "sneakers",
        description:
          "A whole movie on an Air Force 1. Baseball stitching across the toes under a hand-scripted Babe Ruth signature, FOR-EV-ER spelled down the lace tags, The Beast's paw prints at the collar, the Lifeguard cross for the pool scene, the crew walking the midsole in silhouette, Benny's No. 30, sandlot-grass green ringing the outsole — and the quotes inside: \"You're killin' me, Smalls!\" on one insole, \"We play baseball, not like girls!\" on the other. Finished with the Crown City hang tag.",
        imageUrl: "/seed/cc-sl-1.webp",
        extraImages: ["/seed/cc-sl-2.webp", "/seed/cc-sl-3.webp", "/seed/cc-sl-4.webp", "/seed/cc-sl-5.webp"],
      },
      {
        title: "Blue Velvet AF1",
        matchTitle: "velvet",
        baseShoe: "Nike Air Force 1",
        brand: "Nike",
        silhouette: "Air Force 1",
        baseColorway: "Triple White",
        category: "sneakers",
        description:
          "Royal-blue monogram-embossed velvet wrapped over a Triple White Air Force 1 — crisp white swoosh, laces, and midsole set against a pile that shifts with the sunlight, staged on its own matching monogram cloth. Hand-built, one of one, with the Crown City rule attached: no duplicates.",
        imageUrl: "/seed/cc-bv-1.webp",
        extraImages: ["/seed/cc-bv-2.webp", "/seed/cc-bv-3.webp", "/seed/cc-bv-4.webp"],
      },
      {
        title: "We The People Forces",
        matchTitle: "we the people",
        baseShoe: "Nike Air Force 1",
        brand: "Nike",
        silhouette: "Air Force 1",
        baseColorway: "Triple White",
        category: "sneakers",
        description:
          "The Declaration of Independence, corner to corner — aged-parchment script print across the upper, distressed stars-and-stripes at the collar and tongue, an engraved silver lace charm, and a crisp white Swoosh and sole holding it all together. Vintage We The People energy, hand-built one of one under the Crown City rule: no duplicates, ever.",
        imageUrl: "/seed/cc-us-1.webp",
        extraImages: ["/seed/cc-us-2.webp"],
      },
    ],
  },
  {
    // Chicago heavyweight — Dillon DeJesus / DCF (IG
    // @dejesuscustomfootwear ~94K, dejesusinc.com, studio on W 35th
    // St). Tutorials, tool line, and the DCF Experience workshop.
    // Claimable placeholder; outreach via DMs / their site.
    slug: "dejesus",
    email: null,
    displayName: "DeJesus Custom Footwear",
    instagram: "dejesuscustomfootwear",
    city: "Chicago, IL",
    portfolioUrl: "https://www.dejesusinc.com",
    bio: "Chicago's DCF — founded by Dillon DeJesus, painting customs since 2010 after trading architecture school for Angelus and an airbrush. Work on the feet of pro athletes and celebrities, a YouTube channel named a Creator on the Rise with a Shorty Awards breakout nod, full build tutorials, their own tool-and-stencil line, and the DCF Experience — a hands-on workshop taught from the 35th Street studio. Every shoe has a story.",
    pieces: [
      {
        title: "New York Yankees Air Max 90",
        matchTitle: "yankees",
        baseShoe: "Nike Air Max 90",
        brand: "Nike",
        silhouette: "Air Max 90",
        category: "sneakers",
        description:
          "A full team-identity build on the Air Max 90: home-jersey pinstripe panels over navy shadow-camo mesh, a swoosh finished as bat-barrel wood grain — knot and all — the top-hat Yankees crest on the lateral heel, the interlocking NY at the collar, and NEW YORK across the tongue tags. Shot on the diamond and released with its own DCF promo card.",
        imageUrl: "/seed/dj-ny-1.webp",
        extraImages: ["/seed/dj-ny-2.webp", "/seed/dj-ny-3.webp", "/seed/dj-ny-4.webp", "/seed/dj-ny-5.webp"],
      },
      {
        title: "Charizard Jordan 1s",
        matchTitle: "charizard",
        baseShoe: "Air Jordan 1 High",
        brand: "Jordan",
        silhouette: "Air Jordan 1",
        category: "sneakers",
        description:
          "Built for Dillon's brother to wear while vending at trading-card conventions — made to survive full convention days, not sit on a shelf. Charizard from heel to toe: flame-yellow base, wing-teal swoosh, lava-crackle and scale-textured overlays with red trim, crowned by a custom Charizard Wings crest holding a Pokéball. One of DCF's first full-system KixKote builds, with the entire process documented as an in-depth YouTube tutorial.",
        imageUrl: "/seed/dj-cz-1.webp",
        extraImages: ["/seed/dj-cz-2.webp"],
      },
    ],
  },
  {
    // Miami artist + curator (FB: Dr. Funkenstein Acrylics; IG
    // @drfunkenstein_acrylics; shop drfunkensteinacrylics.bigcartel.com).
    // Runs the monthly Rooftop Fam gallery — a scene node, not just a
    // customizer. Contact channel is DMs; claimable placeholder until
    // he takes the page over.
    slug: "dr-funkenstein",
    email: null,
    displayName: "Dr. Funkenstein Acrylics",
    instagram: "drfunkenstein_acrylics",
    city: "Miami, FL",
    portfolioUrl: "https://drfunkensteinacrylics.bigcartel.com",
    bio: "Miami-based artist and curator with Richmond, VA roots — original acrylic work, murals, events, and custom sneakers. Runs Rooftop Fam, Miami's original rooftop art-gallery experience, 20+ editions deep, curating live-art activations from creatives up and down the East Coast.",
    pieces: [
      {
        title: "P-Funk Chucks",
        matchTitle: "funk",
        baseShoe: "Converse Chuck Taylor All-Star Hi",
        brand: "Converse",
        silhouette: "Chuck Taylor All-Star Hi",
        category: "sneakers",
        description:
          "A commission straight out of P-Funk mythology — painted for Michael “Clipadelic” Payne, leader of the 420 Funk Mob, to hit the stage at Essence Fest in New Orleans. Mismatched by design: one Chuck in molten orange tiger stripe, the other in electric teal-and-green, both over a glittering blacked-out canvas, delivered in a fully hand-painted Converse box signed “By Dr. Funkenstein.” First of a four-pair run — a Timberland and two Nikes follow.",
        imageUrl: "/seed/df-pf-1.webp",
        extraImages: ["/seed/df-pf-2.webp", "/seed/df-pf-3.webp", "/seed/df-pf-4.webp"],
      },
    ],
  },
  {
    // Facebook-only customizer (facebook.com/sean.downing.62073) —
    // airbrush + vinyl-stencil work, themed pairs with matching pressed
    // tees. No site, no shop, no IG found: the exact artist this
    // platform exists for. email:null = claimable placeholder account;
    // outreach runs through his FB DMs until he claims.
    slug: "sean-downing",
    email: null,
    displayName: "Sean Downing",
    instagram: null,
    city: null,
    bio: "Airbrush-and-stencil customizer who builds the whole set — the pair and the matching pressed tee. Psycho Bunny Forces, a Dunkin'-themed kicks series, and a full paint-wall bench behind every piece.",
    pieces: [
      {
        title: "Psycho Bunny AF1",
        matchTitle: "psycho bunny",
        baseShoe: "Nike Air Force 1",
        brand: "Nike",
        silhouette: "Air Force 1",
        baseColorway: "Triple White",
        category: "sneakers",
        description:
          "University-gold re-dye over a white Air Force 1 — royal-blue swoosh, laces, and heel tab, with hand-cut Psycho Bunny logo art and the skull-and-crossbones bunny on the lateral. Comes with a matching custom-pressed tee; painted at a full airbrush bench and finished with vinyl-cut stenciling.",
        imageUrl: "/seed/sd-pb-1.webp",
        extraImages: ["/seed/sd-pb-2.webp", "/seed/sd-pb-3.webp", "/seed/sd-pb-4.webp", "/seed/sd-pb-5.webp"],
      },
    ],
  },
  {
    // Already created on the live site from the admin panel — email:null
    // means the seed NEVER touches this page's ownership or claim link,
    // it only guarantees the pieces and their photos survive deploys.
    slug: "hitman-benji",
    email: null,
    displayName: "Hitman Benji",
    instagram: null,
    city: null,
    pieces: [
      {
        title: "Red Cupid Vest",
        matchTitle: "cupid",
        baseShoe: "Tactical vest blank",
        category: "apparel",
        baseColorway: "Red & gold brocade",
        description:
          "Black tactical vest rebuilt over red-and-gold cherub brocade — hand-laid black lace angel wings across the shoulders, inked cupid-girl centerpiece, and the crossed-pistol H×T mark punched underneath.",
        imageUrl: "/seed/hb-cupid-1.webp",
        extraImages: [],
      },
    ],
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

// Team + careers seed — idempotent, runs every deploy in both modes.
// Creates the first editor (Seth) so he can claim + sign in, and posts
// the Editor role on /careers. Never overwrites live edits.
async function seedTeamAndCareers() {
  // First editor: passwordless account he claims via a set-password link
  // the owner sends him (Admin → Team → "Make editor" regenerates it).
  // "seth" is his stable tracked-link handle (theheatchart.com/?ref=seth),
  // set explicitly so it never drifts and his shared links keep working.
  await prisma.user.upsert({
    where: { email: "seal.seth12@gmail.com" },
    update: { role: "EDITOR", refCode: "seth" },
    create: { email: "seal.seth12@gmail.com", name: "Seth", role: "EDITOR", emailVerified: new Date(), refCode: "seth" },
  });

  const editorJob = {
    slug: "editor",
    title: "Custom Brand Scout (Intern)",
    location: "Remote",
    payLine: "$0.50 per artist onboarded",
    body: [
      "## The role",
      "",
      "Run the custom-sneaker brands onto The Heat Chart. You find the",
      "customizers making heat, stage their work on the platform, and push",
      "it out across our socials — all from a simple Editor Desk. Our",
      "website is the origin; the socials are feeders that point back to it.",
      "",
      "## The daily job",
      "",
      "- **Pull 20 a day into the system.** Twenty custom-shoe artists,",
      "  staged and live on the platform.",
      "- For each artist, find **2 pairs of the same maker's work** and",
      "  stage **both pieces** on a fresh, unclaimed artist profile.",
      "- Upload **5–6 photos of each shoe** so voters can swipe every angle.",
      "- **Cross-post** the new pages to every social channel we can post to",
      "  for free, straight from the Desk.",
      "- A tracked link is minted for you, so every artist and every visitor",
      "  you bring in is credited to you.",
      "",
      "## Pay",
      "",
      "**50 cents for every artist you successfully onboard** — an unclaimed",
      "profile with its two staged pieces counts as one. Twenty a day is the",
      "target. Remote, flexible hours.",
      "",
      "## Who we want",
      "",
      "Someone who lives in sneaker culture, knows the custom brands, hustles,",
      "and moves fast. No degree required — show us your feed.",
    ].join("\n"),
  };
  // Upsert so the canonical posting's pay/copy update on deploy, without
  // touching its OPEN/CLOSED status (the owner controls that in admin).
  await prisma.jobPosting.upsert({
    where: { slug: editorJob.slug },
    update: {
      title: editorJob.title,
      location: editorJob.location,
      payLine: editorJob.payLine,
      body: editorJob.body,
    },
    create: editorJob,
  });
}

async function main() {
  // SEED_DEMO=false loads launch content only (trivia bank, articles,
  // shop, giveaway) and skips the placeholder artists/battles — use it
  // for production, then pre-load real artists from /admin.
  const includeDemo = process.env.SEED_DEMO !== "false";

  // Team + careers seed runs in every mode (idempotent top-up).
  await seedTeamAndCareers();

  // Wipe in dependency order so reseeding is idempotent.
  // User accounts, quiz runs, credits, and giveaway entries are kept.
  if (includeDemo) {
    await prisma.tournament.deleteMany();
    await prisma.vote.deleteMany({ where: { userId: null } });
    await prisma.battle.deleteMany();
    await prisma.submission.deleteMany();
    await prisma.product.deleteMany();
    await prisma.article.deleteMany();
    await prisma.quizQuestion.deleteMany();
  }

  if (!includeDemo) {
    // Launch mode runs on EVERY deploy via the start command, so it must
    // never wipe and never overwrite the admin's live edits. Products and
    // the quiz bank seed only into empty tables; articles TOP UP by slug,
    // so fresh drop coverage ships with each release while edited or
    // admin-written articles are left alone.
    const [productCount, questionCount] = await Promise.all([
      prisma.product.count(),
      prisma.quizQuestion.count(),
    ]);
    // One-time retirement of the pre-slug starter set (the Market was
    // never public while it existed), then slug-keyed top-up: curated
    // products are created if missing and NEVER updated, so link/price
    // edits made in /admin survive every deploy. Admin-created products
    // have no slug and are never touched.
    await prisma.product.deleteMany({
      where: { slug: null, name: { in: retiredStarterNames } },
    });
    let newProducts = 0;
    for (const p of products) {
      const exists = await prisma.product.findUnique({ where: { slug: p.slug } });
      if (!exists) {
        await prisma.product.create({ data: p });
        newProducts++;
      }
    }
    if (productCount === 0 || newProducts > 0) {
      console.log(`Market slate: ${newProducts} new product(s) stocked.`);
    }
    let newArticles = 0;
    let refreshed = 0;
    for (const { daysAgo, question, ...a } of articles) {
      const exists = await prisma.article.findUnique({ where: { slug: a.slug } });
      let articleId = exists?.id ?? null;
      let seedManaged = false;
      if (!exists) {
        const created = await prisma.article.create({
          data: { ...a, status: "PUBLISHED", publishedAt: new Date(Date.now() - daysAgo * DAY) },
        });
        articleId = created.id;
        newArticles++;
        seedManaged = true;
      } else {
        // Refresh seed-managed articles the admin has never touched — any
        // admin edit bumps updatedAt past createdAt and wins forever.
        // Seed refreshes pin updatedAt back so they stay refreshable.
        const untouched =
          Math.abs(exists.updatedAt.getTime() - exists.createdAt.getTime()) < 5000;
        if (untouched) {
          await prisma.article.update({
            where: { id: exists.id },
            data: { ...a, publishedAt: exists.publishedAt, updatedAt: exists.createdAt },
          });
          refreshed++;
          seedManaged = true;
        }
      }
      // The culture question riding with the story — floats in the feed,
      // feeds Culture IQ. Created with the article; refreshed only while
      // the article is still seed-managed.
      if (question && articleId) {
        const qData = {
          question: question.q,
          options: JSON.stringify(question.options),
          answerIndex: question.answer,
          category: "culture",
          explanation: question.explain ?? null,
          articleId,
          active: true,
        };
        const existingQ = await prisma.quizQuestion.findFirst({ where: { articleId } });
        if (!existingQ) await prisma.quizQuestion.create({ data: qData });
        else if (seedManaged)
          await prisma.quizQuestion.update({ where: { id: existingQ.id }, data: qData });
      }
    }
    console.log(
      `Articles topped up: ${newArticles} new, ${refreshed} refreshed, admin-edited left untouched.`
    );

    // Roster pre-load: keyed by slug so it never duplicates. Changing an
    // artist's claim email in preloadArtists relinks the page to the new
    // account on the next deploy (email:null = never touch ownership);
    // pieces are keyed by title and created when missing. Admin/artist
    // edits always survive — the seed only fills blanks and replaces
    // photos whose upload files no longer exist on this machine.
    const uploadFileExists = (imageUrl) => {
      if (!imageUrl?.startsWith("/api/uploads/")) return true; // seed/external URLs: not ours to judge
      return existsSync(path.join(process.cwd(), "data", "uploads", path.basename(imageUrl)));
    };

    // Heal any legacy 'headwear' pieces: that category was briefly a
    // fourth lane, then merged back into 'accessories'. Without this,
    // such a piece is orphaned (invisible in every 3-lane filter).
    const healedHats = await prisma.submission.updateMany({
      where: { category: "headwear" },
      data: { category: "accessories" },
    });
    if (healedHats.count > 0) {
      console.log(`Category heal: moved ${healedHats.count} headwear piece(s) → accessories.`);
    }

    // Backfill legacy 'OPEN'-league fit battles to the two real leagues
    // (FAN / HOUSE) so the /outfits page files them under the right
    // section instead of dumping every old one into "Curator Battles."
    const openBattles = await prisma.outfitBattle.findMany({
      where: { league: "OPEN" },
      include: { outfitA: { select: { kind: true } } },
    });
    for (const b of openBattles) {
      await prisma.outfitBattle.update({
        where: { id: b.id },
        data: { league: b.outfitA?.kind === "FAN" ? "FAN" : "HOUSE" },
      });
    }
    if (openBattles.length > 0) {
      console.log(`League backfill: ${openBattles.length} OPEN fit battle(s) relabeled.`);
    }

    // Re-attributions: pieces that were seeded under the wrong artist on
    // an earlier deploy. The roster loop only ADDS pieces, so a stale
    // copy on the live DB would never move — this heals it. Runs BEFORE
    // the roster loop so the correct artist's create step sees the moved
    // piece and doesn't make a duplicate. Idempotent: a no-op once fixed.
    const REATTRIBUTIONS = [
      // "We The People" Forces belongs to Crown City Kicks, not Gunnar.
      { fromSlug: "gunnar-esquivel", toSlug: "crown-city-kicks", titleContains: "we the people" },
    ];
    for (const r of REATTRIBUTIONS) {
      const [from, to] = await Promise.all([
        prisma.artistProfile.findUnique({ where: { slug: r.fromSlug } }),
        prisma.artistProfile.findUnique({ where: { slug: r.toSlug } }),
      ]);
      if (!from || !to) continue;
      const strays = await prisma.submission.findMany({
        where: { artistId: from.id, title: { contains: r.titleContains, mode: "insensitive" } },
      });
      for (const s of strays) {
        const alreadyRight = await prisma.submission.findFirst({
          where: {
            artistId: to.id,
            title: { contains: r.titleContains, mode: "insensitive" },
            id: { not: s.id },
          },
        });
        if (alreadyRight) {
          // The correct artist already has it — remove the stray copy
          // (and any battles referencing it, to satisfy the FK).
          await prisma.battle.deleteMany({ where: { OR: [{ subAId: s.id }, { subBId: s.id }] } });
          await prisma.submission.delete({ where: { id: s.id } }).catch(() => {});
          console.log(`Re-attribution: removed stray "${s.title}" from ${from.displayName}.`);
        } else {
          await prisma.submission.update({
            where: { id: s.id },
            data: {
              artistId: to.id,
              artistName: to.displayName,
              socialHandle: to.instagram,
              email: `claim.${to.slug}@theheatchart.com`,
            },
          });
          console.log(`Re-attribution: moved "${s.title}" from ${from.displayName} → ${to.displayName}.`);
        }
      }
    }

    for (const pa of preloadArtists) {
      const claimEmail = pa.email ?? `claim.${pa.slug}@theheatchart.com`;
      let profile = await prisma.artistProfile.findUnique({ where: { slug: pa.slug } });
      if (!profile) {
        const user = await prisma.user.upsert({
          where: { email: claimEmail },
          update: { name: pa.displayName },
          create: { name: pa.displayName, email: claimEmail },
        });
        profile = await prisma.artistProfile.create({
          data: {
            userId: user.id,
            slug: pa.slug,
            displayName: pa.displayName,
            instagram: pa.instagram,
            city: pa.city,
            bio: pa.bio ?? null,
            portfolioUrl: pa.portfolioUrl ?? null,
            status: "APPROVED",
          },
        });
      } else if (pa.email && profile.userId) {
        // Relink only while the page is unclaimed — once a real artist
        // has a password or OAuth login, the page is theirs forever.
        const user = await prisma.user.upsert({
          where: { email: pa.email },
          update: { name: pa.displayName },
          create: { name: pa.displayName, email: pa.email },
        });
        if (profile.userId !== user.id) {
          const owner = await prisma.user.findUnique({
            where: { id: profile.userId },
            include: { _count: { select: { accounts: true } } },
          });
          const ownerClaimed =
            Boolean(owner?.passwordHash) || (owner?._count.accounts ?? 0) > 0;
          if (!ownerClaimed) {
            profile = await prisma.artistProfile.update({
              where: { id: profile.id },
              data: { userId: user.id },
            });
          }
        }
      }
      const profileFill = {};
      if (pa.bio && !profile.bio) profileFill.bio = pa.bio;
      if (pa.portfolioUrl && !profile.portfolioUrl) profileFill.portfolioUrl = pa.portfolioUrl;
      if (Object.keys(profileFill).length) {
        profile = await prisma.artistProfile.update({
          where: { id: profile.id },
          data: profileFill,
        });
      }
      let newPieces = 0;
      let repaired = 0;
      for (const { matchTitle, ...p } of pa.pieces) {
        const dup = await prisma.submission.findFirst({
          where: {
            artistId: profile.id,
            title: { contains: matchTitle ?? p.title, mode: "insensitive" },
          },
        });
        if (dup) {
          // Fill blanks and heal dead photos; never overwrite live edits.
          const fill = {};
          if (!dup.brand && p.brand) fill.brand = p.brand;
          if (!dup.silhouette && p.silhouette) fill.silhouette = p.silhouette;
          if (!dup.baseColorway && p.baseColorway) fill.baseColorway = p.baseColorway;
          const gallery = dup.extraImages.filter(uploadFileExists);
          if (!uploadFileExists(dup.imageUrl)) {
            fill.imageUrl = p.imageUrl; // cover vanished with a redeploy — restore from the repo
            if (gallery.length !== dup.extraImages.length) fill.extraImages = gallery;
            repaired++;
          } else if (
            dup.imageUrl !== p.imageUrl &&
            !dup.extraImages.includes(p.imageUrl) &&
            p.imageUrl
          ) {
            fill.extraImages = [...gallery, p.imageUrl]; // cover is fine — ride along in the gallery
          }
          if (Object.keys(fill).length) {
            await prisma.submission.update({ where: { id: dup.id }, data: fill });
          }
          continue;
        }
        await prisma.submission.create({
          data: {
            ...p,
            artistName: profile.displayName,
            socialHandle: profile.instagram,
            email: claimEmail,
            status: "APPROVED",
            artistId: profile.id,
          },
        });
        newPieces++;
      }
      console.log(
        `Roster: ${pa.displayName} ready (${newPieces} new pieces${repaired ? `, ${repaired} photos healed` : ""}).`
      );
    }
    // Trivia bank TOPS UP by question text on every deploy — not just
    // into an empty table — so growing questions.json actually reaches
    // the live game instead of freezing at whatever first seeded.
    // (Culture questions come from articles above; these are the
    // standalone trivia bank, keyed articleId = null.)
    const bank = loadQuestions();
    const existingTrivia = await prisma.quizQuestion.findMany({
      where: { articleId: null },
      select: { id: true, question: true, options: true, answerIndex: true },
    });
    const byText = new Map(existingTrivia.map((q) => [q.question, q]));
    let newQuestions = 0;
    let fixedQuestions = 0;
    for (const q of bank) {
      const content = {
        options: JSON.stringify(q.options),
        answerIndex: q.answerIndex,
        difficulty: [1, 2, 3].includes(q.difficulty) ? q.difficulty : 2,
        category: q.category || "history",
        explanation: q.explanation || null,
      };
      const existing = byText.get(q.question);
      if (existing) {
        // Repair the correctness fields when questions.json fixes a wrong
        // answer/options — otherwise a bad answerIndex would score players
        // wrong forever and burn into the IQ ledger. Only touches content
        // that actually differs; never flips the admin's `active` toggle.
        if (existing.options !== content.options || existing.answerIndex !== content.answerIndex) {
          await prisma.quizQuestion.update({ where: { id: existing.id }, data: content });
          fixedQuestions++;
        }
      } else {
        await prisma.quizQuestion.create({ data: { question: q.question, ...content } });
        newQuestions++;
      }
    }
    const totalQuestions = await prisma.quizQuestion.count({ where: { active: true } });
    console.log(
      `Quiz bank: ${newQuestions} new, ${fixedQuestions} corrected; ${totalQuestions} active total.`
    );
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
          endsAt: new Date(Date.now() + 30 * DAY),
        },
      });
    }
    console.log("Seeded launch content only (no demo artists/battles): products, articles, quiz bank, giveaway.");
    return;
  }

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

  for (const { daysAgo, question, ...a } of articles) {
    const created = await prisma.article.create({
      data: {
        ...a,
        status: "PUBLISHED",
        publishedAt: new Date(now - daysAgo * DAY),
      },
    });
    // The article's culture question — same shape as the launch path.
    if (question) {
      await prisma.quizQuestion.create({
        data: {
          question: question.q,
          options: JSON.stringify(question.options),
          answerIndex: question.answer,
          category: "culture",
          explanation: question.explain ?? null,
          articleId: created.id,
          active: true,
        },
      });
    }
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

  // Demo tournament: 4-custom bracket, semifinals decided, final live.
  // Seeds (by heat): 1 gold, 2 bred, 3 venom, 4 toxic → semis (1v4, 2v3).
  const tournament = await prisma.tournament.create({
    data: {
      name: "Summer Heat Championship",
      slug: "summer-heat-championship",
      size: 4,
      prize: "Winner takes the crown + featured on The Heat Chart page",
      roundDays: 3,
    },
  });

  const demoBracket = [
    { round: 1, position: 0, a: "gold", b: "toxic", aVotes: 19, bVotes: 14, done: true },
    { round: 1, position: 1, a: "bred", b: "venom", aVotes: 23, bVotes: 20, done: true },
    { round: 2, position: 0, a: "gold", b: "bred", aVotes: 8, bVotes: 11, done: false },
  ];

  for (const m of demoBracket) {
    const subA = subs[m.a];
    const subB = subs[m.b];
    const battle = await prisma.battle.create({
      data: {
        title: `${m.round === 1 ? "Semifinals" : "Final"} — Summer Heat Championship`,
        subAId: subA.id,
        subBId: subB.id,
        endsAt: m.done ? new Date(now - 1 * DAY) : new Date(now + 3 * DAY),
        status: m.done ? "COMPLETED" : "ACTIVE",
        winnerId: m.done ? (m.aVotes >= m.bVotes ? subA.id : subB.id) : null,
      },
    });
    const votes = [];
    for (let i = 0; i < m.aVotes; i++) votes.push({ battleId: battle.id, submissionId: subA.id, voterKey: `seed-voter-${voterSeq++}` });
    for (let i = 0; i < m.bVotes; i++) votes.push({ battleId: battle.id, submissionId: subB.id, voterKey: `seed-voter-${voterSeq++}` });
    await prisma.vote.createMany({ data: votes });
    await prisma.tournamentMatch.create({
      data: {
        tournamentId: tournament.id,
        round: m.round,
        position: m.position,
        battleId: battle.id,
        subAId: subA.id,
        subBId: subB.id,
        winnerId: m.done ? (m.aVotes >= m.bVotes ? subA.id : subB.id) : null,
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

  // Jordan drop catalog (historical vault + verified 2026 releases),
  // sourced from the owner's master spreadsheets — the accuracy source of
  // truth. Idempotent top-up: create by slug, never overwrite later admin
  // edits, and never touch existing articles (conflicts are reviewed
  // separately, not auto-replaced).
  const catalogPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "catalog-articles.json");
  let catalogArticles = [];
  try {
    catalogArticles = JSON.parse(readFileSync(catalogPath, "utf8"));
  } catch {}
  let catalogAdded = 0;
  for (const a of catalogArticles) {
    if (!a.slug) continue;
    const exists = await prisma.article.findUnique({ where: { slug: a.slug } });
    if (exists) continue;
    await prisma.article.create({
      data: {
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        content: a.content,
        coverImage: a.coverImage ?? null,
        tags: a.tags ?? null,
        status: a.status ?? "PUBLISHED",
        publishedAt: new Date(),
        dropAt: a.dropAt ? new Date(a.dropAt) : null,
      },
    });
    catalogAdded++;
  }

  // One-time reconciliation of the owner-approved conflicts: overwrite
  // each existing article (by slug) with the accurate spreadsheet
  // version. Gated by an AppSetting flag so it runs ONCE on the first
  // deploy after this change and never clobbers later admin edits.
  let reconciled = 0;
  const reconcileFlag = await prisma.appSetting.findUnique({ where: { key: "catalogConflictsV1" } });
  if (!reconcileFlag) {
    const conflictPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "catalog-conflicts.json");
    let conflicts = [];
    try {
      conflicts = JSON.parse(readFileSync(conflictPath, "utf8"));
    } catch {}
    for (const c of conflicts) {
      if (!c.slug) continue;
      const existing = await prisma.article.findUnique({ where: { slug: c.slug } });
      if (!existing) continue;
      await prisma.article.update({
        where: { slug: c.slug },
        data: {
          title: c.title,
          excerpt: c.excerpt,
          content: c.content,
          dropAt: c.dropAt ? new Date(c.dropAt) : null,
        },
      });
      reconciled++;
    }
    await prisma.appSetting.create({
      data: { key: "catalogConflictsV1", value: new Date().toISOString() },
    });
  }
  const totalArticles = await prisma.article.count();

  // Community polls — get-to-know-you opinion questions that ride in the
  // feed. Idempotent top-up: only add a poll whose question isn't present.
  const POLLS = [
    {
      question: "What's your everyday silhouette?",
      options: ["Air Force 1", "Air Jordan 1", "Dunk", "New Balance", "Something nobody else has"],
    },
    {
      question: "How do you rock a fresh pair?",
      options: ["Box-fresh, never creased", "Beat 'em in — made to wear", "Rotate a heavy roster", "Depends on the fit"],
    },
    {
      question: "Where does the custom scene live hardest for you?",
      options: ["The DMV", "NYC / Tri-state", "The West Coast", "The South", "Online only"],
    },
    {
      question: "What pulls you to a custom first?",
      options: ["The colorway", "The story behind it", "Wild technique", "Who made it"],
    },
    {
      question: "Your grail right now is…",
      options: ["A retro Jordan", "A rare collab", "A one-of-one custom", "The pair that started it for me"],
    },
    {
      question: "How'd you find The Heat Chart?",
      options: ["Designer Kicks / Facebook", "An artist put me on", "A friend", "Just stumbled in"],
    },
  ];
  let pollsAdded = 0;
  for (const p of POLLS) {
    const exists = await prisma.poll.findFirst({ where: { question: p.question } });
    if (!exists) {
      await prisma.poll.create({
        data: { question: p.question, options: JSON.stringify(p.options) },
      });
      pollsAdded++;
    }
  }
  const totalPolls = await prisma.poll.count({ where: { active: true } });

  console.log(
    `Seeded ${submissions.length} submissions, ${battles.length} battles, ${products.length} products, ${totalArticles} articles (+${catalogAdded} catalog, ${reconciled} reconciled), ${questions.length} quiz questions, ${totalPolls} polls (+${pollsAdded} new).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

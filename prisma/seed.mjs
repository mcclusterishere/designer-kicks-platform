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
    email: "demo+kelz@theheatchart.example",
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
    email: "demo+solefire@theheatchart.example",
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
    email: "demo+icebox@theheatchart.example",
    baseShoe: "New Balance 990v6",
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
    dropAt: new Date("2026-09-05T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
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
    dropAt: new Date("2026-10-10T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
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
    dropAt: new Date("2026-08-08T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
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
    content: [
      "## The drop",
      "",
      "The **Air Jordan 4 'Birds of Paradise'** lands **Wednesday, July 23, 2026** for **$220** as a women's exclusive. The blocking is Coconut Milk leather over Bright Mango hits with a Muslin midsole — the rare 4 that reads soft instead of loud, and it photographs beautifully.",
      "",
      "## How to cop",
      "",
      "1. **SNKRS** at 10 AM ET — set the notification now.",
      "2. **Retailer raffles** — women's-exclusive 4s often sit a touch longer than the men's hype pairs, so in-store lists are a real path.",
      "3. Sizing note: women's sizing — men, convert down 1.5 and hunt the larger end of the run.",
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
    title: "Air Jordan 8 'BIN 23' Drops July 24 at $350 — The Premium Series Is Back",
    excerpt:
      "The Air Jordan 8 'BIN 23' releases July 24, 2026 for $350 in Legion Pine and red — the luxury BIN series returns with full-grain leather and numbered pairs.",
    tags: "Jordan, Release Dates, Grails",
    coverImage: "/seed/drop-2.svg",
    dropAt: new Date("2026-07-24T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    daysAgo: 0,
    content: [
      "## The drop",
      "",
      "**BIN 23 is back.** The premium line that gave grails the luxury treatment returns on the **Air Jordan 8**, dropping **Thursday, July 24, 2026** at **$350**. Legion Pine nubuck, deep red accents, upgraded materials throughout — this is the 8 built like a dress shoe.",
      "",
      "## Why it matters",
      "",
      "BIN pairs are produced in tighter numbers than general releases and historically hold resale value better than almost any non-collab retro. If you're buying one pair this month as an investment piece, this is the conversation.",
      "",
      "## How to cop",
      "",
      "1. **SNKRS** — expect an exclusive-access wave to eat some stock.",
      "2. Boutique accounts (the premium tier usually hits select doors, not every mall retailer).",
      "",
      "## The collector angle",
      "",
      "A $350 retail with limited numbers is exactly the kind of piece our [Market](/market) exists for — record the sale with a receipt and the ✓ travels with the shoe forever.",
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
    content: [
      "## The drop",
      "",
      "The **Air Jordan 4 'Comic'** hits **Saturday, July 25, 2026** for **$230** — Off White base, Anthracite structure, and Fire Pink hits with comic-book ink detailing on the panels. It's the loudest 4 of the summer and the one your feed will not shut up about.",
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
    content: [
      "## Two grails, one morning",
      "",
      "**Saturday, August 1, 2026** is the deepest morning of the summer: the **Air Jordan 13 'Flint'** returns in Navy/Flint Grey/University Blue at **$215**, and the **Air Jordan 1 High OG 'Love Letter'** drops in Shadow Brown and Team Red at **$185**.",
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
    title: "Kobe 5 Protro 'Dodgers' Drops August 15 — Mamba in Dodger Blue",
    excerpt:
      "The Nike Kobe 5 Protro 'Dodgers' releases August 15, 2026 for $190 — Rush Blue, Wolf Grey, and Comet Red. Release details and how to actually get a pair.",
    tags: "Kobe, Release Dates, SNKRS",
    coverImage: "/seed/drop-5.svg",
    dropAt: new Date("2026-08-15T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    daysAgo: 0,
    content: [
      "## The drop",
      "",
      "The **Nike Kobe 5 Protro 'Dodgers'** releases **Saturday, August 15, 2026** for **$190** — Rush Blue upper, Wolf Grey accents, Comet Red hits. August is quietly a Kobe month (the 8 'Mambacurial' lands Aug 8 and the 10 'Halo' follows Aug 23), and this is the crown jewel of the three.",
      "",
      "## Why it will be brutal to get",
      "",
      "Kobe Protros are the most-camped drops on SNKRS right now, hoops kids and collectors both want them, and LA energy on a Dodgers colorway adds a whole city to the queue.",
      "",
      "## How to cop",
      "",
      "1. **SNKRS**, 10 AM ET — no exclusives expected, pure draw.",
      "2. **House of Hoops / Foot Locker app raffles** typically run the week prior.",
      "3. Backup: the 8 'Mambacurial' on Aug 8 cools off faster if you just want Mamba energy on foot.",
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
    content: [
      "## The drop",
      "",
      "The **Air Jordan 9 OG 'Space Jam'** releases **Saturday, August 29, 2026** for **$215** under style code **HV4794-106**. The blocking is the one the culture knows by heart: white leather base, black nubuck mudguard sweeping up into the collar, True Red hits on the tongue branding, the heel's globe emblem, and red Jumpmans under the outsole. The **OG** tag is earned — this pair returns with **shaping corrected to the 1993 original**, part of Jordan Brand's push for historical accuracy.",
      "",
      "![Air Jordan 9 OG Space Jam — pair](/seed/spacejam9-pair.jpg)",
      "",
      "## The anniversary box",
      "",
      "This isn't a standard-box release. **Space Jam hit theaters November 15, 1996** — thirty years ago this fall — and the 9 comes wrapped for the occasion: a **Tune Squad-styled lid**, a **galaxy-print interior**, and a hardwood-court insert telling the story of the film that united Michael Jordan and Bugs Bunny, with both the AJ9 and AJ11 featured on screen. Collectors: the box is part of the grail this time. Keep it clean.",
      "",
      "![The 30th-anniversary Space Jam packaging](/seed/spacejam9-box.jpg)",
      "",
      "## The history — the Jordan MJ never wore in an NBA game",
      "",
      "Tinker Hatfield designed the 9 for a season that never happened. It released in **November 1993 at $125** — weeks after MJ walked away from basketball to play minor-league baseball — making it the only numbered Air Jordan of his career that he never laced up in an NBA game as an active player. Hatfield leaned into the moment: a minimalist upper, a one-pull lacing system, the lightest Jordan yet, and an outsole ringed with words in **Japanese, Swahili, Russian and more** — 'dedicated,' 'intense,' 'freedom' — a map of how far past basketball the man's reach had grown.",
      "",
      "And when Chicago raised **'The Spirit'** — the Jordan statue outside the United Center — on November 1, 1994, Hatfield put the 9 on its feet. It has stood in this shoe for three decades.",
      "",
      "## The retro record",
      "",
      "The White/Black-True Red 9 came back in **2002**, in **2010**, and for the film's 20th anniversary in **November 2016**, when it first took the 'Space Jam' name alongside the 11. The 2026 release is its **first return in OG trim** — and the first with the anniversary packaging.",
      "",
      "![On foot](/seed/spacejam9-onfoot.jpg)",
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
  // SEED_DEMO=false loads launch content only (trivia bank, articles,
  // shop, giveaway) and skips the placeholder artists/battles — use it
  // for production, then pre-load real artists from /admin.
  const includeDemo = process.env.SEED_DEMO !== "false";

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
    if (productCount === 0) {
      for (const p of products) {
        await prisma.product.create({ data: p });
      }
    }
    let newArticles = 0;
    let refreshed = 0;
    for (const { daysAgo, ...a } of articles) {
      const exists = await prisma.article.findUnique({ where: { slug: a.slug } });
      if (!exists) {
        await prisma.article.create({
          data: { ...a, status: "PUBLISHED", publishedAt: new Date(Date.now() - daysAgo * DAY) },
        });
        newArticles++;
        continue;
      }
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
      }
    }
    console.log(
      `Articles topped up: ${newArticles} new, ${refreshed} refreshed, admin-edited left untouched.`
    );
    if (questionCount === 0) {
      for (const q of loadQuestions()) {
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
    }
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

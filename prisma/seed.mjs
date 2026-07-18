// Seeds demo submissions, battles, votes, the affiliate shop, the
// trivia question bank (prisma/questions.json), and a demo giveaway.
// Run with: npm run db:seed  (safe to re-run — it wipes and reseeds
// demo content; it does NOT touch user accounts)
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
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
    title: "Nike Kobe 5 Protro 'Dodgers' (IO6256-400): Release Date, Price & the Full Story",
    excerpt:
      "Everything on the Nike Kobe 5 Protro 'Dodgers' — the August 15, 2026 release date, $190 price, style code IO6256-400, Rush Blue with red baseball stitching — plus the whole lineage: the Kobe 6 'Dodgers' that began as Vanessa Bryant's player exclusive and debuted on the mound at Dodger Stadium.",
    tags: "Kobe, Release Dates, SNKRS, Dodgers",
    coverImage: "/seed/kb6d-1.webp",
    dropAt: new Date("2026-08-15T12:00:00Z"),
    raffleUrl: "https://www.nike.com/launch",
    daysAgo: 0,
    content: [
      "## Quick facts",
      "",
      "| | |",
      "| --- | --- |",
      "| **Shoe** | Nike Kobe 5 Protro 'Dodgers' |",
      "| **Style code** | IO6256-400 |",
      "| **Colorway** | Rush Blue / Wolf Grey / Comet Red |",
      "| **Price** | $190 |",
      "| **Release date** | August 15, 2026 (some retail calendars point to September 8 — see below) |",
      "| **Where** | SNKRS + select Nike Basketball retailers |",
      "",
      "## When does the Kobe 5 Protro 'Dodgers' drop?",
      "",
      "Most release calendars — including the majors — have the **Kobe 5 Protro 'Dodgers'** landing **Saturday, August 15, 2026 for $190**. A minority of calendars list **September 8**. Kobe dates move more than any line Nike runs, so treat August 15 as the target and check back the week of. Either way it caps a loaded stretch: the 8 'Mambacurial' lands August 8 and the 10 Elite Low 'Halo' follows on Mamba Day, August 23.",
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
      "Kobe was an LA institution across every code the city plays — courtside at Staples, in the stands at Chavez Ravine. The Dodgers honored him after his passing, and the 8/24 numbers still ring around both franchises every Mamba Day. A Dodger-blue Kobe isn't a novelty colorway; it's a city handshake.",
      "",
      "![Full-length Game Royal outsole with the sheath logo under the Kobe 6 'Dodgers'](/seed/kb6d-5.webp)",
      "",
      "## How to actually get a pair",
      "",
      "1. **SNKRS, 10 AM ET** on release day — pure draw, enter from every account in the household.",
      "2. **House of Hoops / Foot Locker app raffles** typically open the week prior.",
      "3. Watch **UNDEFEATED and boutique Nike Basketball accounts** — the 6 'Dodgers' proved this line gets boutique-first treatment.",
      "4. Miss it? The 8 'Mambacurial' (Aug 8) cools off faster if you just want Mamba energy on foot.",
      "",
      "## FAQ",
      "",
      "**Is the 'Dodgers' a Kobe 5 or a Kobe 6?** Both exist. The **6** (CW2190-400) was the original — Vanessa Bryant's PE turned retail release. The **5** (IO6256-400) is the 2026 follow-up covered here.",
      "",
      "**What did the Kobe 6 'Dodgers' retail for?** $180 at retail; resale ran multiples of that from day one.",
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

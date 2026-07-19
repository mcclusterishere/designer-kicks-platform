# The Heat Chart — Custom Sneaker Culture Platform

Live at [theheatchart.com](https://theheatchart.com). Built and operated
by **McCluster Corp** through its **Equity Uprise** program, The Heat
Chart grew out of the **Designer Kicks** community into a full platform
for custom-sneaker culture: independent artists submit their work, go
head-to-head in community vote battles, and climb **The Heat List**.
Member accounts power voting, the Heat Check culture game, and rare-shoe
giveaway entries. A newsroom pulls in search traffic; an affiliate shop
helps sustain the work.

## About

The Heat Chart is a project of **McCluster Corp**, developed through its
**Equity Uprise** program — a mission-driven initiative that treats
sneaker customization as both a cultural art form and a route to real
economic opportunity. The platform is built to:

- **celebrate and pass on the culture** — the Heat Check game turns the
  history behind each silhouette into something people learn by playing;
- **open doors for independent artists** — the League, closets, and
  provenance tools give makers a place to build a name and earn from
  their craft; and
- **double as hands-on learning** — designing, building, and running the
  platform is itself a real-world workshop in design, technology, and
  creative entrepreneurship.

We see custom sneakers as a vehicle for cultural exchange and for the
kind of creative and workforce skill-building that meets people where
their passion already is.

## What's on the site

| Page | What it does |
|---|---|
| `/` | Hype homepage — giveaway banner, live battles, Heat List, Drop Report, shop picks |
| `/submit` | Artists upload a photo of their custom + their story (goes to a review queue) |
| `/battles` | Live vote battles with countdowns + past battle results |
| `/battles/[id]` | Head-to-head page — sign in to vote, one vote per member, live percentages |
| `/tournaments` `/tournaments/[slug]` | Seeded single-elimination championship brackets — every match is a live vote battle |
| `/artists` `/artists/[slug]` | The League — artists ranked by career W-L records, with profile pages and followers |
| `/heat-list` | Every approved custom, ranked by battle wins then total votes |
| `/news` | Drop Report — SEO-driven articles on upcoming releases (dates, prices, raffle links) |
| `/quiz` | The Heat Check — Jordan trivia; 12 correct answers earns a giveaway entry |
| `/giveaway` | Current rare-shoe giveaway, entry counts, past winners, rules |
| `/signin` `/register` `/profile` | Member accounts — email/password + optional Google/Facebook, password recovery, contact-info profile |
| `/shop` | Affiliate marketplace — marketplaces, releases, customizer paints, cleaning, accessories |
| `/admin` | Your dashboard — submissions, battles, giveaways, quiz questions, members (+ CSV export), articles, products |

## Run it locally

You need a PostgreSQL database. Easiest options: local Postgres
(`docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`)
or a free [Neon](https://neon.tech) database.

```bash
cp .env.example .env # then set DATABASE_URL to your Postgres
npm install          # also runs prisma generate
npm run db:deploy    # applies the committed migrations
npm run db:seed      # loads demo battles, 60 trivia questions, shop, articles
npm run dev          # http://localhost:3000
```

Admin panel: go to `/admin`. In development the password defaults to
`heatcheck`. **In production, admin login is disabled until you set a
real `ADMIN_PASSWORD`** — there is no default. Sessions are signed,
expire after 12 hours, die immediately if you change the password, and
login attempts are rate-limited.

## Accounts

- Email/password sign-up with bcrypt hashing, password recovery via
  emailed reset links (2-hour expiry).
- **Google / Facebook sign-in**: create OAuth apps and set
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and/or
  `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` in `.env` — buttons
  appear automatically. Redirect URI:
  `https://yourdomain.com/api/auth/callback/google` (or `/facebook`).
- **Reset emails**: set `RESEND_API_KEY` (resend.com) + `EMAIL_FROM`.
  Without it, reset links print to the server console (and show
  on-screen in `npm run dev` only — never in production).
- Profiles collect phone, city, shoe size, favorite silhouette,
  Instagram, and a marketing opt-in. View/export everything from the
  admin Members table (CSV button).

## Fans vs artists (two account tiers)

- **Fan accounts are instant** — register and you can vote, play the
  Heat Check, enter giveaways, follow artists, and own pieces.
- **Artist accounts are applied for and reviewed** (`/submit` shows the
  application to fans). Admin approves/rejects in the Artist
  Applications queue; only APPROVED artists can submit customs. This is
  the vetting layer the future payout rails (Stripe Connect) will sit on.
- Rejected applicants can update their info and reapply.

## The League (artist profiles)

- Approved artists have league profiles (display name, Instagram,
  unique URL slug); every submission posts under that identity — no
  more "KickGod" vs "@kickgod" fragmentation.
- Artist pages (`/artists/[slug]`) show a career record (W–L, win rate,
  total votes), follower count, a Trophy Shelf of championship titles,
  and The Closet — every shoe with its live Heat List rank. Members can
  follow artists.
- `/artists` is the league table: every artist with an approved shoe,
  ranked by career wins then total votes.

## Ownership & fan closets

- One-of-ones have provenance: when an artist sells a piece (on or off
  platform), they hit "Sold it? Transfer to buyer" on their own page and
  enter the buyer's account email (admins can also transfer).
- The buyer gets a public **collector closet** at `/collectors/[slug]`
  (minted on first piece): their owned customs with live heat ranks,
  plus their fan stats and quiz badges. Their private profile shows
  "My Closet" with a link to the public page.
- The artist's closet shows provenance ("🔑 In [name]'s closet") linking
  to the collector.

## How the battles work

1. Artist submits at `/submit` → lands in the `/admin` review queue.
2. You approve it, then pair any two approved customs into a battle
   (1–30 days) from the admin panel.
3. Members get one vote per battle (signed-in only — every voter is a
   contact in your list).
4. When the clock runs out the battle finalizes itself and the winner
   takes a `W` on the Heat List. Wins rank first, total votes break ties.

## Tournaments (championship brackets)

- Admin launches a bracket (4/8/16 customs) from approved submissions;
  seeding is automatic by heat score, and round-1 battles go live
  immediately.
- Every match is an ordinary vote battle. When a round's battles
  finalize (cron or page load), winners advance automatically and
  next-round battles spin up; tied votes advance the higher seed.
- The final crowns a champion shown on the bracket, the tournaments
  page, and the homepage banner. "End round now" in admin fast-forwards
  a round.

## The Heat Check (quiz game)

- A run climbs toward **12 correct answers** from a shuffled queue of
  the 60-question Jordan bank (no repeats within a run).
- A wrong answer costs a **strike** and skips to the next question (no
  brute-forcing answers by retrying).
- Everyone gets **3 free strikes a day** (resets midnight UTC). Out of
  strikes mid-run? **$1 buys a pack of 4** — resuming the stalled run
  charges the pending strike. Unused strikes roll over.
- **Giveaway entries come only from runs completed on free strikes.**
  Purchased strikes keep a run alive for the all-time **leaderboard and
  badges** — they never produce an entry or affect giveaway odds
  (sweepstakes-law separation between payment and prize).
- Tune the economy in `lib/quiz.ts` (`FREE_STRIKES_PER_DAY`,
  `HEAT_CHECK_TARGET`, `PACK_SIZE`, `PACK_PRICE_CENTS`).
- Answers are validated server-side and never sent to the browser.

**Payments**: set `STRIPE_SECRET_KEY` to enable real $1 Stripe Checkout
purchases (add `STRIPE_WEBHOOK_SECRET` and point a webhook at
`/api/stripe/webhook`; the success redirect also credits idempotently,
so purchases work even before the webhook is configured). Without a
key, a clearly-labeled dev-mode purchase grants credits instantly for
testing.

**⚠️ Legal — read before launching the paid giveaway**: a promotion
combining a prize, chance, and payment is a lottery in most US states.
The free daily strikes exist as the free entry path ("no purchase
necessary") and the site carries that language, but **have a lawyer
review your official rules before charging real money**. The rules
summary on `/giveaway` is a placeholder, not legal advice.

## Giveaways

Create giveaways in the admin panel (prize, description, end date).
Heat Check winners auto-enter the active giveaway. After it ends, hit
"Draw winner" — a random entry wins and the winner's name/email shows
in the admin list; past winners appear on `/giveaway`.

## The newsroom (SEO engine)

Articles live at `/news/<slug>` and are written in Markdown from the
admin panel (Newsroom section). Built-in SEO:

- Per-article meta title/description, canonical URL, OpenGraph + Twitter
  cards, and `NewsArticle` JSON-LD structured data (Google rich results)
- `sitemap.xml` (auto-includes every published article and battle),
  `robots.txt`, and an RSS feed at `/news/feed.xml`
- The **excerpt field is the meta description** — front-load the search
  phrase people type ("[shoe] release date") and keep it under ~160 chars
- Slugs auto-generate from the headline; keep the keyword in it
- Drafts are hidden until you tick "Published"

Set `NEXT_PUBLIC_SITE_URL` in `.env` to your real domain when you deploy
so canonical URLs, the sitemap, and OG tags point at the right place.

Article playbook for drop SEO: one article per hyped release, headline
formatted like "Air Jordan X 'Colorway': Release Date, Price & Where To
Buy" — that matches what people actually search. Update the article
after the drop with resale info to keep it ranking.

## Money: the affiliate shop

The shop ships pre-stocked with 18 hand-picked link cards across five
categories, currently pointing at **plain merchant URLs**. Read
**[AFFILIATES.md](./AFFILIATES.md)** — it's the full playbook of real
affiliate programs (signup links, commission rates, which network hosts
each one, and the fastest approval path). As programs approve you, paste
your tagged links in via `/admin` → Shop Products → Edit.

FTC affiliate disclosure is already baked into the footer and shop page.

## Demo content

The seeded submissions use labeled SVG placeholder art ("DEMO SUBMISSION
— REPLACE WITH REAL PHOTOS"). Real submissions from the `/submit` form
use actual uploaded photos (stored in `data/uploads/`, served via
`/api/uploads/...`). To start with a clean, empty site:

```bash
npx prisma db push --force-reset   # wipe everything
```

## Mobile app shell

On phones the site behaves like an app: a fixed bottom tab bar
(**Home · Arena · 🔥 Heat Check · Drops · Profile**) replaces the top
nav, with the quiz in the raised center slot. The Arena tab is the
competitive hub (battles, brackets, league, Heat List via pill links).
The site is an installable **PWA** (`manifest.webmanifest` + icons):
"Add to Home Screen" gives a full-screen, home-icon app experience with
no app store — which also keeps quiz credit purchases on Stripe instead
of Apple's 30% in-app-purchase cut. Desktop keeps the top nav.

## Tests

Browser end-to-end suites live in `e2e/` and cover accounts, gated
voting, the full quiz/credits loop (including the paid-run/giveaway
separation), tournament advancement, the artist league, and the
newsroom's SEO surface, the mobile tab-bar/PWA shell, and the full fan-to-artist-to-collector journey (80 checks).

```bash
npm run build && npm start     # in one terminal, against a seeded DB
npm run test:e2e               # in another
```

Optional env: `E2E_BASE_URL`, `CHROMIUM_PATH`, `ADMIN_PASSWORD`, and
`SERVER_LOG` (path to the server's stdout log — enables the
password-reset delivery check). Suites clean up their own test data.

## Going live

- **Stack**: Next.js 16 (App Router) · TypeScript · Tailwind v4 ·
  Prisma + PostgreSQL · S3-compatible object storage for uploads
  (falls back to local disk in dev) · scheduled battle finalization via
  `/api/cron/finalize`.
- **[DEPLOY.md](./DEPLOY.md) is the full launch checklist** — database
  (Neon), storage (Cloudflare R2), hosting (Vercel or a persistent-disk
  host), email (Resend), Stripe live mode, OAuth apps, and the
  pre-announcement checklist.
- Hot actions (voting, sign-up, password reset, submissions) are
  rate-limited in-process; swap `lib/ratelimit.ts` to Redis at scale.

## Pointing the Facebook page at it

The homepage is the funnel: hero → submit CTA, live battles above the
fold. Post individual battle URLs (`/battles/<id>`) to the page — that's
the page people can vote on directly, and battle voting is the
share/return loop that builds the audience the affiliate programs want
to see when they review your application.

---

The Heat Chart is a project of **McCluster Corp** / **Equity Uprise**.
© 2026 McCluster Corp.

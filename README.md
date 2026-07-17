# Designer Kicks — Custom Sneaker Battle Platform

The website behind the **Designer Kicks** Facebook page: custom sneaker
artists submit their work, go head-to-head in community vote battles,
and climb **The Heat List**. Member accounts power voting, the Jordan
Heat Check trivia game, and rare-shoe giveaway entries — and build your
contact list. A newsroom pulls in search traffic; an affiliate shop
monetizes it.

## What's on the site

| Page | What it does |
|---|---|
| `/` | Hype homepage — giveaway banner, live battles, Heat List, Drop Report, shop picks |
| `/submit` | Artists upload a photo of their custom + their story (goes to a review queue) |
| `/battles` | Live vote battles with countdowns + past battle results |
| `/battles/[id]` | Head-to-head page — sign in to vote, one vote per member, live percentages |
| `/heat-list` | Every approved custom, ranked by battle wins then total votes |
| `/news` | Drop Report — SEO-driven articles on upcoming releases (dates, prices, raffle links) |
| `/quiz` | The Heat Check — Jordan trivia; 12 correct answers earns a giveaway entry |
| `/giveaway` | Current rare-shoe giveaway, entry counts, past winners, rules |
| `/signin` `/register` `/profile` | Member accounts — email/password + optional Google/Facebook, password recovery, contact-info profile |
| `/shop` | Affiliate marketplace — marketplaces, releases, customizer paints, cleaning, accessories |
| `/admin` | Your dashboard — submissions, battles, giveaways, quiz questions, members (+ CSV export), articles, products |

## Run it locally

```bash
npm install          # also runs prisma generate
npm run db:push      # creates prisma/dev.db (SQLite)
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

## How the battles work

1. Artist submits at `/submit` → lands in the `/admin` review queue.
2. You approve it, then pair any two approved customs into a battle
   (1–30 days) from the admin panel.
3. Members get one vote per battle (signed-in only — every voter is a
   contact in your list).
4. When the clock runs out the battle finalizes itself and the winner
   takes a `W` on the Heat List. Wins rank first, total votes break ties.

## The Heat Check (quiz game)

- A run climbs toward **12 correct answers** from a shuffled queue of
  the 60-question Jordan bank (no repeats within a run).
- A wrong answer costs a **strike** and skips to the next question (no
  brute-forcing answers by retrying).
- Everyone gets **3 free strikes a day** (resets midnight UTC). Out of
  strikes mid-run? **$1 buys a pack of 4** — the run pauses and resumes
  after purchase. Unused strikes roll over.
- Passing the Heat Check earns an **entry into the active giveaway**.
  Run it as many times as you like.
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

## Going live

- **Stack**: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma + SQLite
- Any Node host with a persistent disk works out of the box (Railway,
  Render, Fly.io, a VPS): `npm run build && npm start`.
- On **Vercel** the filesystem is ephemeral — swap SQLite for a hosted
  Postgres (Neon/Supabase: change `provider` in `prisma/schema.prisma`
  and `DATABASE_URL`) and store uploads in Vercel Blob or S3
  (`app/actions.ts` → `createSubmission`, `app/api/uploads/`).
- Set a strong `ADMIN_PASSWORD` before you share the link anywhere.

## Pointing the Facebook page at it

The homepage is the funnel: hero → submit CTA, live battles above the
fold. Post individual battle URLs (`/battles/<id>`) to the page — that's
the page people can vote on directly, and battle voting is the
share/return loop that builds the audience the affiliate programs want
to see when they review your application.

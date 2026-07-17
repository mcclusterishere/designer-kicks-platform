# Designer Kicks — Custom Sneaker Battle Platform

The website behind the **Designer Kicks** Facebook page: custom sneaker
artists submit their work, go head-to-head in community vote battles,
and climb **The Heat List**. An affiliate shop monetizes the traffic.

## What's on the site

| Page | What it does |
|---|---|
| `/` | Hype homepage — live battles, Heat List top 3, featured shop picks |
| `/submit` | Artists upload a photo of their custom + their story (goes to a review queue) |
| `/battles` | Live vote battles with countdowns + past battle results |
| `/battles/[id]` | Head-to-head page — one vote per person, live percentages |
| `/heat-list` | Every approved custom, ranked by battle wins then total votes |
| `/news` | Drop Report — SEO-driven articles on upcoming releases (dates, prices, raffle links) |
| `/shop` | Affiliate marketplace — marketplaces, releases, customizer paints, cleaning, accessories |
| `/admin` | Your dashboard — approve/reject submissions, start/end battles, write news articles, manage shop products |

## Run it locally

```bash
npm install          # also runs prisma generate
npm run db:push      # creates prisma/dev.db (SQLite)
npm run db:seed      # loads demo battles + the starter shop
npm run dev          # http://localhost:3000
```

Admin panel: go to `/admin`, password is `heatcheck` — **change it** by
setting `ADMIN_PASSWORD` in `.env` (copy `.env.example` to `.env`).

## How the battles work

1. Artist submits at `/submit` → lands in the `/admin` review queue.
2. You approve it, then pair any two approved customs into a battle
   (1–30 days) from the admin panel.
3. Visitors get one vote per battle (anonymous cookie + a unique
   constraint in the database — no login needed).
4. When the clock runs out the battle finalizes itself and the winner
   takes a `W` on the Heat List. Wins rank first, total votes break ties.

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

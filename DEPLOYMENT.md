# The Heat Chart — Deployment Checklist

The launch sequence, in order. Everything deploys from `main` on
Railway; merging the open PR is the deploy trigger.

## 1. Railway (the site itself)

- [ ] **Merge the open PR** — Railway builds and deploys `main`
- [ ] **Postgres plugin attached** and `DATABASE_URL` present (auto)
- [ ] **Volume mounted at `/app/data`** — keeps artist photo uploads
      alive across deploys (without it, uploads vanish on every deploy;
      the roster's seed photos self-heal, but claimed artists' uploads
      won't)
- [ ] **Custom domain** `theheatchart.com` attached + DNS CNAME set
- [ ] Env vars (Settings → Variables):

| Variable | Purpose | Status |
| --- | --- | --- |
| `ADMIN_EMAILS` | `mattmccluster@gmail.com` — admin sign-in | required |
| `AUTH_SECRET` | session crypto — `openssl rand -base64 32` | required |
| `RESEND_API_KEY` + `EMAIL_FROM` | outreach + claim + reset emails | recommended |

  Resend DNS (Railway → Domains → theheatchart.com). Names must match
  exactly — the two mail records live on the `send` subdomain, NOT `@`:

  | Type | Name | Content | Priority |
  | --- | --- | --- | --- |
  | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
  | TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
  | TXT | `resend._domainkey` | `p=MIGfMA0…` (from Resend) | — |

  `EMAIL_FROM`: `The Heat Chart <league@theheatchart.com>` — sending
  needs no mailbox. Receiving at league@: free forwarder (ImprovMX)
  with root MX `@` → `mx1.improvmx.com` (10) + `mx2.improvmx.com`
  (20), alias league@ → your Gmail; reply-as via Gmail send-as with
  SMTP `smtp.resend.com`, user `resend`, password = the API key.
| `GOOGLE_PLACES_API_KEY` | Store Scout zip scans | optional |
| `AFF_EBAY_TEMPLATE` … | affiliate tags on /go links | as approved |
| `FB_PAGE_ID` / `FB_PAGE_ACCESS_TOKEN` / `IG_USER_ID` | Broadcast auto-posting | optional |
| `CRON_SECRET` | guards `/api/cron/*` (finalize + drop-date sync) | recommended |
| `KICKSDB_KEY` **or** `RAPIDAPI_STOCKX_KEY` **or** `APIFY_TOKEN` | drop-date auto-sync by SKU | optional |
| `ANTHROPIC_API_KEY` (+ opt. `ADVISOR_MODEL`) | turns on the /sell AI Selling Advisor | optional |
| `REF_EBAY_URL` / `REF_SHOPIFY_URL` / `REF_ETSY_URL` / `REF_DEPOP_URL` / `REF_GRAILED_URL` / … | your referral sign-up links on /sell | optional |
| `NEXT_PUBLIC_GA_ID` | GA override only — live property is built in | not needed |

  **Selling Hub** (`/sell`): platform guides + a Claude "Selling Advisor"
  chat for artists learning to sell. The chat is **dormant** until
  `ANTHROPIC_API_KEY` is set (it returns a friendly fallback and makes zero
  outbound calls), so it ships free and turns on with the key. Each platform
  card's button uses your `REF_<PLATFORM>_URL` referral link if set, else the
  platform's plain sign-up page. Artists link their own stores in the Studio
  ("Where you sell") → shown as "Shop their work" on their public page.

  **Drop-date auto-sync** (Admin → Newsroom → "Drop date auto-sync"):
  put a style code (SKU, e.g. `DZ5485-612`) on any drop article and the
  site pulls its release date from a provider waterfall — KicksDB →
  StockX (RapidAPI, host `stockx5.p.rapidapi.com`) → Apify — trying each
  until one answers. It's **dormant** with no key set (zero outbound
  calls), so it ships safe for $0; add any one free-tier key to switch it
  on. A human-set date is tagged `manual` and is never overwritten by a
  scraper. Schedule the nightly job like `finalize`:
  `GET /api/cron/refresh-drops` with `Authorization: Bearer <CRON_SECRET>`
  (daily is plenty — cached resale data 24h old is fine for a calendar).
  Optional overrides: `KICKSDB_API_URL`, `RAPIDAPI_STOCKX_HOST`,
  `APIFY_SNEAKER_ACTOR`.

## 2. Post-deploy smoke test (5 minutes, on your phone)

- [ ] Home page loads; **The Feed** scrolls and keeps loading
- [ ] Sign in → vote in a battle → play 3 cards of **Rate**
- [ ] `/drops` → tap a marked day → sheet opens, buy links work
- [ ] Any artist page → photos render (volume check)
- [ ] Admin → Broadcast a "we're live" post (pin it)
- [ ] GA **Realtime** shows your visit; tap a buy link → `affiliate_click` event appears

## 3. Analytics — already done, just verify

Nothing left to build. The GA4 property (G-SN0FRY5FY3) is baked in and
domain-gated; first-party Traffic Pulse runs in admin. After deploy:

- [ ] GA Realtime shows traffic (see smoke test)
- [ ] In GA: **Admin → Events → mark `affiliate_click` as a key event**
      (one click — makes it a conversion for reporting)
- [ ] Optional: link **Google Search Console** (Admin → Product links)
      for SEO query data on the drop articles

## 4. iOS — two phases

**Phase 1 (now): PWA.** Already built — manifest, standalone display,
icons, app-style tab bar. iPhone users: Share → **Add to Home Screen**
→ full-screen app with no Safari chrome. Put a "Get the app" line in
the site footer / FB posts; zero cost, zero review, live today.

**Phase 2 (when traction justifies $99/yr): App Store.**
- [ ] Apple Developer account ($99/yr) + a Mac with Xcode
- [ ] Wrap with **Capacitor** (`npx cap add ios`) pointing at
      theheatchart.com — the app-ish design and tab bar already read
      as native
- [ ] App Review reality: Apple rejects thin website wrappers
      (guideline 4.2 "minimum functionality"). The Rate game, push-able
      feed, and quiz are the native-feeling features to lead with in
      review notes. Add push notifications via Capacitor before
      submitting — it's the strongest "this needs to be an app" signal
      and your retention lever.
- [ ] TestFlight beta with the founding artists first — their feedback
      is also your App Review social proof.

Recommendation: ship Phase 1 today, start Phase 2 after the FB traffic
test proves retention (App Review takes days-to-weeks and the PWA
loses nothing meanwhile).

## 4.5 Ready for a traffic flood (1k+ users)

The repo now handles most of this itself — but two settings are yours:

- [ ] **Size the DB pool.** In Railway → Postgres → the `DATABASE_URL`
      you copy into the app service, append
      `?connection_limit=20&pool_timeout=20&connect_timeout=10`. Without
      it Prisma's tiny default pool is the first thing to fall over under
      a spike. Keep `connection_limit` well under Postgres `max_connections`.
- [ ] **Run ONE instance for launch.** The in-memory rate limiter and the
      startup seed assume a single instance. Don't enable replicas/
      autoscaling for the launch window (Hobby is single by default).
- [ ] **Schedule the finalizer.** Battles finalize lazily on page views
      (throttled to once/min), but add a scheduler hitting
      `GET /api/health`-style `GET /api/cron/finalize` with the
      `Authorization: Bearer <CRON_SECRET>` header every few minutes so
      results settle even in quiet hours. (Any external cron / GitHub
      Action works; Railway has a cron service.)
- [ ] **Schedule the drop-date sync** (only once a sneaker-API key is set —
      it's a no-op otherwise). Same scheduler, once a day:
      `GET /api/cron/refresh-drops` with the `Authorization: Bearer
      <CRON_SECRET>` header. Keys/behavior are in §1's env table.
- [ ] Optional but ideal: set the `S3_*` vars (Cloudflare R2 free tier)
      so artist photos serve from the bucket, not through the app process.

What the repo already does for you now: `railway.json` runs
`prisma db push` (syncs the new columns/tables) + the idempotent seed +
`next start` on every deploy, with `/api/health` as the healthcheck; hot
query paths are indexed; the finalizer is throttled; security headers,
a branded error page, and a 404 page are in place.

## 5. First-week ops

- [ ] Broadcast the launch post (pinned) + cross-post everywhere
- [ ] Move already-contacted artists to their real pipeline stages in
      admin Outreach (Crown City → Contacted, JSB → In Talks, etc.)
- [ ] Apply: eBay Partner Network (instant) → KicksCrew → StockX/GOAT
      via Impact once GA has 2–3 weeks of history
- [ ] Watch Traffic Pulse + GA after the first FB post; double down on
      whichever group/post format converts

## 6. Affiliate go-live (the money switch)

The site is already wired: every buy link routes through /go, logs to
Market Pulse in /admin, and auto-tags itself from the `AFF_*_TEMPLATE`
Railway variables. Full program-by-program details live in
**AFFILIATES.md**. The human sequence:

1. [ ] Prereqs once: business email (league@theheatchart.com), payout
       bank account or PayPal, and your tax info (W-9 as an individual
       is fine to start — every network asks during onboarding).
2. [ ] **Day one, no review barrier:** eBay Partner Network (paste the
       campid append-template) and FlexOffers (unlocks Flight Club,
       Stadium Goods, Grailed, Crep Protect, Finish Line, JD Sports).
3. [ ] **Amazon Associates** — covers all the supply/accessory cards.
       Remember: 3 qualifying sales in 180 days or reapply.
4. [ ] **Awin ($5 refundable deposit) → Etsy** — the custom-sneaker
       marketplace; our audience commissions work there.
5. [ ] **After 2–3 weeks of GA history:** Impact applications — StockX,
       KicksCrew, Foot Locker, adidas, END. Use Market Pulse screenshots
       as traffic proof.
6. [ ] **Direct customizer programs:** Angelus, Reshoevn8r, Lace Lab —
       small brands, warm to creators; email if the portal is closed.
7. [ ] As each approval lands, paste its template into Railway
       (AFFILIATES.md → "How links get paid") — no code changes, links
       upgrade site-wide instantly.
8. [ ] When the slate looks right in /admin, flip `SHOP_LIVE` to true in
       lib/flags.ts (one word) and the Market goes public.

---

_The Heat Chart is a project of McCluster Corp / Equity Uprise._

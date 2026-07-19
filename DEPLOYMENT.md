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
| `NEXT_PUBLIC_GA_ID` | GA override only — live property is built in | not needed |

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

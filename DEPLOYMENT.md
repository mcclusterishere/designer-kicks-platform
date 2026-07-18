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

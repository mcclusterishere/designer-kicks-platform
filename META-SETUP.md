# Meta setup — the exact clicks

The site is fully wired for Meta. This file is the other half: what to
click in [developers.facebook.com](https://developers.facebook.com) so
the wiring goes live. Work top to bottom; each section ends with the
env vars it produces. Set every env var on Railway, redeploy, and the
admin **Settings → readiness rows** flip green as each one lands.

Source of truth for this layout: Meta's own "Create an App" doc,
pulled via their Developer Tools MCP. Three rules drive everything:

1. **The consumer "Authenticate and request data from users with
   Facebook Login" use case cannot share an app with ANY business use
   case.** Selecting it greys the rest out — that's by design, not a
   bug. It gets its own tiny app.
2. **The business use cases stack in ONE app** — Pages, Messenger,
   Instagram, Threads, all three Marketing API use cases (Meta's doc
   explicitly blesses Threads + Pages together). The one split inside
   the business world: an app holds only ONE of the two Instagram API
   setups, so editor IG connects get a small third app.
3. **Use cases can be added to an app later, but NEVER removed.** Add
   generously — a use case you skip today is another dashboard visit
   tomorrow; a use case you add is permanent either way.

Also: you can hold a role on at most **15 apps** unless they're
connected to a verified business portfolio. Three is fine.

The dashboard groups the 20 use cases as Ads and monetization (7),
Content management (5), Business messaging (3), Others (5). App 1
takes twelve of them (confirmed live: creating the app with exactly
this combination shows "12 use cases added" and a working Next
button); the notes below say why each remaining one is either
disabled by the dashboard itself or skipped on purpose.

| App | Type | Serves |
|---|---|---|
| **App 1 — "The Heat Chart Business"** | Business | House Page + IG + Threads posting, the chat bot's inbox, comments, webhooks, editor Facebook-Page connects, ads/leads/insights via Marketing API, Catalog, Live Video, oEmbed, **app-install ads for the iOS app** |
| **App 2 — "The Heat Chart Login"** | Consumer | The "Sign in with Facebook" button for fans — nothing else |
| **App 3 — "The Heat Chart Creators"** | Business | Editor Instagram connects only — one app can hold only ONE of the two Instagram API setups, and the house needs the Facebook-Login setup while editors need the Instagram-Login one |

---

## App 1 — the business app

**Create App** → select ALL of these use cases (they're mutually
compatible; incompatible ones grey out and none of these should):

1. **Manage everything on your Page** — Page publishing, comment
   moderation, insights. Under Customize, add: `pages_manage_posts`,
   `pages_read_engagement`, `pages_manage_engagement`,
   `pages_read_user_content`, `pages_manage_metadata`,
   `read_insights`.
2. **Engage with customers on Messenger from Meta** — this is where
   `pages_messaging` lives (NOT in the Pages use case) — the chat
   bot's inbox depends on it.
3. **Manage messaging & content on Instagram** — IG DMs, comments,
   publishing: `instagram_basic`, `instagram_manage_messages`,
   `instagram_manage_comments`, `instagram_content_publish`, plus the
   **Human Agent** feature (7-day human reply window). Inside the use
   case, pick the **"API setup with Facebook Login"** flavor — the
   house IG is Page-linked, and this flavor is also what Business
   Discovery and hashtag search require. (The Instagram-Login flavor
   lives in App 3; one app can't hold both.)
4. **Access the Threads API** — mints the separate **Threads App
   ID/Secret** pair (below the Meta pair on Basic settings). Scopes:
   `threads_basic`, `threads_content_publish`,
   `threads_manage_replies`, `threads_read_replies`,
   `threads_manage_insights`.
5. **Create & manage ads with Marketing API** — `ads_management`,
   `ads_read`, `business_management`.
6. **Capture & manage ad leads with Marketing API** —
   `leads_retrieval` + the leadgen webhook.
7. **Measure ad performance data with Marketing API** — reporting.
8. **Create & manage ads with ads MCP server** — "build AI agents
   that manage ads on behalf of advertisers." This is what lets
   Claude run campaigns directly through Meta's ads MCP instead of
   handing over instructions. Highest-leverage box on the screen.
9. **Manage products with Catalog API** — feeds the shoe catalog and
   marketplace into dynamic ads and Meta commerce surfaces.
10. **Access the Live Video API** — a STANDALONE use case (confirmed
   live in the dashboard, in Content management — Meta's written docs
   describe it as a feature buried inside Pages; the dashboard is the
   real authority and it lists separately). Streaming to the Page
   needs no extra permission beyond `pages_manage_posts`, but
   Facebook requires the Page to have 100+ followers and a 60-day-old
   account to go live.
11. **Embed content (oEmbed)** — tokenless since June 15, 2026, so
   embedding public posts works without it; adding it costs nothing
   and buys higher rate limits.
12. **Create & manage app ads with Meta Ads Manager** — mobile-app
   INSTALL campaigns. CONFIRMED LIVE in the dashboard: this combines
   fine with the full business bundle above (Pages, Instagram,
   Messenger, Threads, all three Marketing API cases, Catalog, Live
   Video, oEmbed, ads MCP) — it was checkable and stayed checkable
   through all of it. It does NOT need to wait for App 2 or the iOS
   launch; add it now so the iOS app's install campaigns, when they
   start, share the same app as the rest of the ad stack. (Earlier
   version of this doc had it parked on App 2 — that was theorizing
   from Meta's written docs before the dashboard was actually driven
   with this exact combination; the live wizard overrides it.)

NOT ADDED — greyed out by the dashboard once the above was selected,
confirmed live, not a judgment call:

- **Allow users to transfer their data to other apps** (Data
  Portability) — went from selectable to disabled once enough of the
  bundle above was checked. It's still true that the use case itself
  is free and inert (see git history for the full reasoning) — this
  just means THIS particular combination of use cases doesn't leave
  room for it. Nothing to do about it; move on.
- **Authenticate and request data from users with Facebook Login** —
  disabled the moment any business use case is present, as expected.
  Lives on App 2.
- **Launch an Instant Game on Facebook and Messenger** — disabled,
  unrelated to anything here.
- **Join ThreatExchange** — disabled, and would have been skipped
  anyway (see below).

SKIP LIST — these stayed selectable and were left unchecked on
purpose, each for its own reason:

- **Advertise on your app with Meta Audience Network** — the
  opposite of the business model: it places OTHER advertisers' ads
  inside our product to monetise it. We sell subscriptions and
  marketplace sales; renting our users' attention to competitors
  works against both.
- **Share or create fundraisers on Facebook and Instagram** — the
  API only creates person-for-CHARITY fundraisers; a for-profit
  cannot raise for itself. Only useful if a charity drop with a real
  nonprofit beneficiary happens.
- **Connect with customers through WhatsApp** — a real capability but
  a whole second messaging stack (dedicated business number, message
  templates, its own approval). Addable any time; add it when a
  WhatsApp channel is actually wanted.

Marketing API notes: managing YOUR OWN ad account needs NO App Review
— Standard Access covers it. But the starting ("Limited") tier is a
tiny quota: 60 points per ad account per 5 minutes (reads=1,
writes=3, 5-minute lockout on breach) — fine for launch, and when
real ad ops start, request the tier upgrade under App Review >
Marketing API Access Tier. Lead webhooks need TWO subscriptions: the
app-level `leadgen` field AND `POST /{page-id}/subscribed_apps?subscribed_fields=leadgen`
with the Page token — miss the second and leads silently never
arrive. Live Video to the Page uses `pages_manage_posts` (no extra
permission), but Facebook requires the Page to have 100+ followers
and a 60-day-old account to go live at all — ours clears both.

**Business:** attach the McCluster Corp portfolio and start
verification NOW — it gates Advanced Access on everything, it's the
long pole, and nothing else waits on it.

**App Settings → Basic:**

| Field | Value |
|---|---|
| App Domains | `theheatchart.com` |
| Privacy Policy URL | `https://theheatchart.com/privacy` |
| Terms of Service URL | `https://theheatchart.com/terms` |
| Data Deletion Instructions URL | `https://theheatchart.com/privacy` |

**Redirect URIs** (Facebook Login for Business settings — it's added
to business apps automatically):

```
https://theheatchart.com/api/social/callback/facebook_page
```

Instagram business-login setup screen:
```
https://theheatchart.com/api/social/callback/instagram
```

Threads use case settings:
```
https://theheatchart.com/api/social/callback/threads
```

**Webhooks** — after `META_WEBHOOK_VERIFY_TOKEN` is set on Railway and
deployed (Meta calls the URL during the handshake):

- Callback URL: `https://theheatchart.com/api/meta/webhooks`
- Page topic fields: `feed`, `messages`, `mention`
- Instagram topic fields: `comments`, `mentions`, `messages`

(Once the app is granted to the Developer Tools MCP, Claude can run
the webhook subscription itself.)

**App Roles:** team as Testers (FB accounts), Instagram Testers (IG
accounts — accept inside the IG app), Threads testers (accept inside
Threads → Settings → Account → Website permissions).

No dev/live switch exists on Business apps. **Standard Access** —
automatic, zero review — works at full strength for anyone with a
role on the app or its portfolio: real posts, real DMs, your own ad
account. App Review / Advanced Access only gates serving strangers.

**House tokens** (Graph API Explorer, pick App 1):

1. User token with: `pages_show_list`, `pages_manage_posts`,
   `pages_read_engagement`, `pages_manage_engagement`,
   `pages_read_user_content`, `pages_messaging`,
   `pages_manage_metadata`, `read_insights`, `instagram_basic`,
   `instagram_content_publish`, `instagram_manage_comments`,
   `instagram_manage_messages`, `ads_management`, `ads_read`,
   `leads_retrieval`, `business_management`.
2. **Extend the token FIRST** (Access Token Debugger → Extend), THEN
   `GET /me/accounts` → the Page's `id` → `FB_PAGE_ID`, its
   `access_token` → `FB_PAGE_ACCESS_TOKEN`. Page tokens minted from an
   extended user token never expire; from a short one they die in an
   hour.
3. `GET /{FB_PAGE_ID}?fields=instagram_business_account` →
   `IG_USER_ID`.
4. Threads use case → authorize the house Threads profile → long-lived
   token → `THREADS_USER_ID` + `THREADS_ACCESS_TOKEN` (60 days; the
   env-var house token needs re-minting before day 60 — DB-held
   editor tokens refresh themselves).

→ Railway: `META_BUSINESS_APP_ID`, `META_BUSINESS_APP_SECRET` (App
1's Meta pair), `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `IG_USER_ID`,
`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `THREADS_APP_ID`,
`THREADS_APP_SECRET`, `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN`,
`META_WEBHOOK_VERIFY_TOKEN`.

---

## App 2 — the login app

**Create App** → use case **Authenticate and request data from users
with Facebook Login** (everything else greys out — correct, this app
does one job). Permissions: `public_profile`, `email` — both granted
without review.

- Valid OAuth Redirect URI:
  `https://theheatchart.com/api/auth/callback/facebook`
- Same Basic-settings URLs as App 1.

App-install ads live on App 1 now (confirmed compatible with the full
business bundle — see App 1's list), not here. This app stays exactly
one use case, forever: the sign-in button.

→ Railway: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` (App 2's
pair — the site's sign-in button reads these).

---

## App 3 — the creators app

**Create App** → use case **Manage messaging & content on Instagram**
→ inside it, pick the **"API setup with Instagram business login"**
flavor. This mints the **Instagram App ID/Secret** pair that editor
IG connections use — creators sign in with their own Instagram, no
Facebook Page required.

- Redirect URI (on that setup screen):
  `https://theheatchart.com/api/social/callback/instagram`
- Add the editors' IG accounts as Instagram Testers here too.

→ Railway: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` (App 3's
Instagram pair).

---

## After creating all three

**Re-authorize the Developer Tools MCP connector and grant ALL the apps
on the consent screen.** From then on Claude can audit settings,
subscribe webhooks, watch rate limits and read compliance/App Review
status directly.

## App Review (public release — later)

Everything already works for the team under Standard Access. Submit
for Advanced Access when strangers need to connect their own channels:
`pages_manage_posts`, `instagram_business_basic`,
`instagram_business_content_publish`, `threads_basic`,
`threads_content_publish`. Screencast of an editor connecting +
auto-posting; business verification must be done. Expect 2–4 weeks.

## What Meta does not allow — so we didn't build it

- **Posting to personal Facebook profiles** (removed 2018, no
  permission restores it).
- **Posting into Groups** (Groups API removed 2024 — the Group Run
  panel is the legal fast lane).
- **Cold DMs / bulk outreach** (the 24-hour window is structural; the
  bot only ever answers).
- **Scraping** (Business Discovery + insights are the sanctioned
  data lanes).
- **Tagging users in Facebook Page posts** (no API for it; IG tagging
  works and is wired).

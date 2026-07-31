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
3. **Use cases can be added later but NEVER removed — and each one is
   a permanent ANNUAL cost, not just a permanent line item.** Meta's
   Data Access Renewal requires certifying every permission the app
   holds, every year, on a 60-day clock with no extensions, and the
   penalty for missing it is the app being DEACTIVATED. So the rule is
   the opposite of "add generously": add what you will use, because
   each addition is something you re-attest to forever. Permissions
   INSIDE a use case are individually removable even though the use
   case isn't — that's the release valve. Note also that removing a
   permission later does not fully erase exposure: Meta says an app
   "may still be evaluated for permissions and features it could
   previously access," so not-adding is cleaner than add-then-remove.

Also: you can hold a role on at most **15 apps** unless they're
connected to a verified business portfolio. Three is fine.

The dashboard groups the 20 use cases as Ads and monetization (7),
Content management (5), Business messaging (3), Others (5). App 1
takes TEN of them. Twelve was selectable and confirmed working in
the live wizard ("12 use cases added"), but an adversarial preflight
pass found two worth dropping before creation — oEmbed (#11, buys
nothing) and Lead Ads (#6, welds high-sensitivity PII on permanently
for a feature not shipping yet). Both are addable later. The notes
below say why each remaining one is either disabled by the dashboard
itself or skipped on purpose.

| App | Type | Serves |
|---|---|---|
| **App 1 — "The Heat Chart Business"** | Business | House Page + IG + Threads posting, the chat bot's inbox, comments, webhooks, editor Facebook-Page connects, ads/leads/insights via Marketing API, Catalog, Live Video, **app-install ads for the iOS app** |
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
   `instagram_manage_comments`, `instagram_content_publish`, and
   **`instagram_manage_insights`** — that last one is easy to miss and
   Business Discovery does not work without it. Missing it returns
   `(#10) Application does not have permission for this action`, which
   reads like an App Review problem but is just an absent scope. Plus
   the **Human Agent** feature (7-day human reply window), which is a
   separate App Review application, not an automatic inclusion.

   Inside the use case, pick the **"API setup with Facebook Login"**
   flavor. THE ONE-WAY DOOR: only one setup per app, and Meta
   documents no way to undo it. Do not click "Set up" on the "API
   setup with Instagram business login" row even to look — that button
   is what registers the setup. Business Discovery, hashtag search and
   media deletion exist ONLY on the Facebook Login path. (The
   Instagram-Login flavor lives in App 3.)
4. **Access the Threads API** — mints the separate **Threads App
   ID/Secret** pair (below the Meta pair on Basic settings). Scopes:
   `threads_basic`, `threads_content_publish`,
   `threads_manage_replies`, `threads_read_replies`,
   `threads_manage_insights`.
5. **Create & manage ads with Marketing API** — `ads_management`,
   `ads_read`, `business_management`.
6. **Capture & manage ad leads with Marketing API** —
   `leads_retrieval` + the leadgen webhook. COST: `leads_retrieval` is
   a REQUIRED, non-removable permission on this use case, and it
   returns lead-form PII (name, email, phone). It is the most
   sensitive data class in the whole bundle and the likeliest thing to
   pull the evidence-upload section (data-deletion procedure,
   retention window, possibly a security certification) onto every
   annual renewal. Only take it if lead ads are actually running;
   otherwise add it the day the first lead campaign launches — #5 and
   #7 cover all other ad work without it.
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
11. ~~**Embed content (oEmbed)**~~ — **SKIP.** An earlier version of
   this doc said it "buys higher rate limits." That was wrong: Meta's
   announcement says higher limits come with token-based access
   *through App Review*, which we are not doing for oEmbed. Since the
   endpoints are tokenless for public content, the use case buys
   literally nothing over calling
   `graph.facebook.com/v25.0/instagram_oembed?url={url}` directly —
   while permanently adding two features (Meta oEmbed Read, Threads
   oEmbed Read) to certify at every annual renewal. Add it only if a
   real rate limit is ever hit.
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
`THREADS_APP_ID`, `THREADS_APP_SECRET`, `THREADS_USER_ID`,
`THREADS_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`.

NOT here: `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`. App 1 uses the
Facebook-Login Instagram setup, which authenticates against the Meta
app pair and never mints an Instagram App ID. Only App 3's
Instagram-Login setup produces that pair, and in the code those two
vars are read solely by the editor connect flow in `lib/metaConnect.ts`.

---

## App 1, immediately after Create — do not skip

The wizard does NOT reliably attach every permission a use case
implies. Scopes that were never explicitly added come back as
"Invalid Scopes" at OAuth time, which looks exactly like a code bug
and isn't. With this many use cases stacked at once it's likely, not
hypothetical.

1. **Walk every use case's "Permissions and features" tab one at a
   time** and confirm each needed scope shows as added — BEFORE
   generating any token. When an OAuth call later rejects a scope,
   check this dashboard first; do not start editing auth code.
2. **Pages use case:** only `business_management`, `pages_show_list`,
   `public_profile` are auto-added (required, non-removable), plus
   `pages_manage_engagement` as a removable default. Everything the
   platform actually runs on is an optional add you must click:
   `pages_manage_posts`, `pages_read_engagement`,
   `pages_read_user_content`, `pages_manage_metadata`, `read_insights`.
   (`pages_manage_metadata` is what lets the app subscribe the Page to
   the messages/feed webhooks — without it the whole bot goes deaf.)
3. **Instagram use case:** add `instagram_manage_insights` explicitly,
   then re-mint the user token so the scope is actually in it. Verify
   with `GET /me/permissions` before debugging anything.
4. **Remove auto-added permissions you aren't using.** Permissions are
   individually removable even though use cases aren't — this is what
   keeps the annual renewal cheap.
5. **Set the app contact email to a monitored inbox** and verify the
   developer-account email. Data Access Renewal notice goes to app
   admins and that contact address; a missed email deactivates the
   app after 60 days with no extension. Put a monthly reminder to
   check the Required Actions dashboard — do not rely on email.

**One cheap experiment once the token exists** — Business Discovery
against an account we don't own may need Advanced Access, or may not;
the evidence is mixed. Run one call and find out rather than planning
around a guess:

```
GET /{IG_USER_ID}?fields=business_discovery.username(SOMEONE_ELSE){followers_count,media_count}
```

Data back = creator lookups ship immediately. `(#10)` with the scope
confirmed present = bundle Advanced Access for
`instagram_manage_insights` into the same App Review submission as
Instagram Public Content Access (which is what hashtag search needs,
capped at 30 tags per 7 days with a 24-hour recency window — not a
launch feature).

**Architectural warning for later:** shared permissions
(`public_profile`, `business_management`, `pages_show_list`,
`pages_read_engagement`, `ads_management`) are required across many of
these use cases at once. Raising any of them from Standard to Advanced
Access propagates the change across every use case sharing it and can
pull new review requirements onto use cases we never meant to submit.
The editor Facebook-Page connect flow is the thing that will
eventually need Advanced Access — strongly consider moving it onto App
3 rather than App 1, so the big app stays entirely on Standard Access
where no App Review is needed at all for managing our own assets.

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

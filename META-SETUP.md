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
2. **All the business use cases stack in ONE app** — Pages, Messenger,
   Instagram, Threads, all three Marketing API use cases, oEmbed.
   (Meta's doc explicitly blesses Threads + Pages in one app.)
3. **Use cases can be added to an app later, but NEVER removed.** Add
   generously — a use case you skip today is another dashboard visit
   tomorrow; a use case you add is permanent either way.

Also: you can hold a role on at most **15 apps** unless they're
connected to a verified business portfolio. Two is fine.

| App | Type | Serves |
|---|---|---|
| **App 1 — "The Heat Chart Business"** | Business | House Page + IG + Threads posting, the chat bot's inbox, comments, webhooks, editor channel connections, ads/leads/insights via Marketing API, Live Video, embeds |
| **App 2 — "The Heat Chart Login"** | Consumer | The "Sign in with Facebook" button for fans |

---

## App 1 — the business app

**Create App** → select ALL of these use cases (they're mutually
compatible; incompatible ones grey out and none of these should):

1. **Manage everything on your Page** — Page publishing, comment
   moderation, insights. Under Customize, add: `pages_manage_posts`,
   `pages_read_engagement`, `pages_manage_engagement`,
   `pages_read_user_content`, `pages_manage_metadata`,
   `read_insights`. Its optional features include the
   **Live Video API** — tick it while you're there.
2. **Engage with customers on Messenger from Meta** — this is where
   `pages_messaging` lives (NOT in the Pages use case) — the chat
   bot's inbox depends on it.
3. **Manage messaging & content on Instagram** — IG DMs, comments,
   publishing: `instagram_basic`, `instagram_manage_messages`,
   `instagram_manage_comments`, `instagram_content_publish`, plus the
   **Human Agent** feature (7-day human reply window). Also run the
   "API setup with Instagram business login" here — it mints the
   separate **Instagram App ID/Secret** editors connect with.
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
8. **Embed Facebook, Instagram and Threads content in other
   websites** — the oEmbed features, for embedding posts on the site.

Skip: "Create & manage app ads with Meta Ads Manager" (mobile-app
install ads — explicitly does NOT include the Marketing API),
"Fundraisers" (the `manage_fundraisers` permission has eligibility
strings attached — revisit if a charity drop ever happens), Instant
Games, Audience Network, WhatsApp (later, deliberately).

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

→ Railway: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` (App 2's
pair — the site's sign-in button reads these).

---

## After creating both

**Re-authorize the Developer Tools MCP connector and grant BOTH apps
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

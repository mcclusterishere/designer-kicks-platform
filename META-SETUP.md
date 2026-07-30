# Meta setup — the exact clicks

The site is fully wired for Meta. This file is the other half: what to
click in [developers.facebook.com](https://developers.facebook.com) so
the wiring goes live. Work top to bottom; each section ends with the
env vars it produces. Set every env var on Railway, redeploy, and the
admin **Settings → readiness rows** flip green as each one lands.

One structural fact drives the whole layout: **Threads cannot share an
app with Facebook Login.** So this is a TWO-app setup:

| App | Use cases | Serves |
|---|---|---|
| **App 1 — "The Heat Chart"** | Facebook Login + Manage everything on your Page + Instagram | Site sign-in, house Page + IG posting, inbox, comments, webhooks, editor IG/Page connections |
| **App 2 — "The Heat Chart Threads"** | Access the Threads API | House Threads posting + editor Threads connections |

---

## App 1 — the main app

**Create App** → add use cases:

1. **Authenticate and request data from users with Facebook Login** —
   the sign-in button. Needs only `public_profile` + `email` (granted
   automatically).
2. **Manage everything on your Page** — the engine. Under its
   Customize → Permissions, add:
   - `pages_manage_posts` — publish to the Page (nothing works without it)
   - `pages_read_engagement` — read back what posts do
   - `pages_manage_engagement` — reply to / hide comments
   - `pages_read_user_content` — see visitor comments
   - `pages_messaging` — the Page inbox (Messenger + IG DMs)
   - `pages_manage_metadata` — webhook subscriptions
3. **Instagram** — add BOTH setups:
   - *API with Facebook Login* (`instagram_basic`,
     `instagram_content_publish`, `instagram_manage_comments`,
     `instagram_manage_messages`) — this is how the HOUSE account posts
     and reads DMs, because our IG is linked to the Page.
   - *API setup with Instagram business login* — this is how EDITORS
     connect their own IG. It mints a separate **Instagram App
     ID/Secret** (on that setup screen, not App Settings → Basic).

**App Settings → Basic:**

| Field | Value |
|---|---|
| App Domains | `theheatchart.com` |
| Privacy Policy URL | `https://theheatchart.com/privacy` |
| Terms of Service URL | `https://theheatchart.com/terms` |
| Data Deletion Instructions URL | `https://theheatchart.com/privacy` |

**Facebook Login → Settings → Valid OAuth Redirect URIs** — all three:

```
https://theheatchart.com/api/auth/callback/facebook
https://theheatchart.com/api/social/callback/facebook_page
https://theheatchart.com/api/social/callback/instagram
```

(The Instagram business-login setup screen has its own redirect field —
put `https://theheatchart.com/api/social/callback/instagram` there too.)

**Webhooks** (product → Webhooks → Page + Instagram objects):

- Callback URL: `https://theheatchart.com/api/meta/webhooks`
- Verify token: invent a random string; it becomes
  `META_WEBHOOK_VERIFY_TOKEN` on Railway. **Set the env var and deploy
  BEFORE clicking Verify** — Meta calls the URL during the handshake.
- Subscribe fields — Page: `feed`, `messages`, `mention`.
  Instagram: `comments`, `mentions`, `messages`.

**Business verification** (App Settings → Business verification):
attach the McCluster Corp business portfolio and start it NOW — it's
the long pole (days, not minutes) and `pages_manage_posts` Advanced
Access waits on it, not the other way around.

**App Roles → Roles:** add the editors (their Facebook accounts as
**Testers**, their IG accounts under **Instagram Testers** — each must
accept the invite inside the Instagram app; Threads testers accept
inside Threads under Settings → Account → Website permissions).

Don't hunt for a "switch to Live" toggle — Business-type apps don't
have one. Access is per-permission: **Standard Access** is automatic,
needs zero review, and works at FULL strength for anyone with a role
on the app or its business portfolio. Real posts, real DMs, real
Pages. App Review / Advanced Access is only the gate for serving
strangers. So the whole feature runs for the team on day one.

**House tokens** (Graph API Explorer, pick App 1):

1. User token with `pages_show_list`, `pages_manage_posts`,
   `pages_read_engagement`, `pages_manage_engagement`,
   `pages_read_user_content`, `pages_messaging`,
   `pages_manage_metadata`, `instagram_basic`,
   `instagram_content_publish`, `instagram_manage_comments`,
   `instagram_manage_messages`.
2. **Extend it first** (Access Token Debugger → Extend), THEN
   `GET /me/accounts` → copy the Page's `id` → `FB_PAGE_ID` and its
   `access_token` → `FB_PAGE_ACCESS_TOKEN`. A Page token minted from an
   extended user token never expires; minted from a short one, it dies
   in an hour and you'll be re-pasting tokens forever.
3. `GET /{FB_PAGE_ID}?fields=instagram_business_account` → the id →
   `IG_USER_ID`.

→ Railway: `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `IG_USER_ID`,
`FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` (App ID/Secret from
Basic), `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`,
`META_WEBHOOK_VERIFY_TOKEN`.

---

## App 2 — the Threads app

**Create App** → use case **Access the Threads API** → permissions
`threads_basic`, `threads_content_publish` (add
`threads_manage_replies` + `threads_read_replies` while you're there —
adding later means another review).

- Redirect URI: `https://theheatchart.com/api/social/callback/threads`
  (HTTPS only; Threads refuses localhost).
- The **Threads App ID/Secret** are their own pair in App Settings →
  Basic, BELOW the Meta app id. Using the top pair fails with error
  4476002.
- Add the team as Threads testers (accept in the Threads app).
- House account token: use the app's Threads API setup to authorize
  @theheatchart's Threads profile, exchange for a long-lived token
  (60 days; the site auto-refreshes tokens it holds in the database,
  but the HOUSE token lives in an env var — re-mint it or move the
  house account to a connected channel before day 60).

→ Railway: `THREADS_APP_ID`, `THREADS_APP_SECRET`, `THREADS_USER_ID`,
`THREADS_ACCESS_TOKEN`.

---

## App Review (public release)

Everything already works for the team in Development mode. App Review
is what lets STRANGERS connect their channels. Submit when ready:

- App 1: `pages_manage_posts`, `instagram_business_basic`,
  `instagram_business_content_publish` (+ the engagement permissions if
  the desk should serve Pages we don't own — for our own Page,
  Standard Access is enough).
- App 2: `threads_basic`, `threads_content_publish`.
- Each needs a screencast: record an editor connecting a channel on
  /editor and a piece auto-posting after approval. The Development-mode
  run IS the screencast.
- Business verification must be finished first. Expect 2–4 weeks.

---

## What Meta does not allow — so we didn't build it

- **Posting to personal Facebook profiles.** Removed platform-wide in
  2018. Editors connect a Page (free to create) or use the share
  button.
- **Cold DMs / bulk outreach.** The API cannot message anyone who
  hasn't messaged us first. The Engagement desk and its rules only ever
  ANSWER. Outreach stays manual (the DM scripts in the Editor Desk).
- **Scraping profiles, groups, or emails.** The sanctioned outward
  look is Business Discovery (the admin "Scout an Instagram account"
  card): follower counts, bio, post counts for public
  business/creator handles — via the API, within rate limits. It runs
  on the house token and needs `instagram_basic` (already in the App 1
  list). Hashtag search exists too but is gated behind an extra
  App-Review feature ("Instagram Public Content Access") and capped at
  30 hashtags/week — worth submitting later, not day one.
- **Tagging users in Facebook Page posts.** Not a thing the API can
  do; attribution on FB is the artist's name in the copy + link.
  Instagram is better: house posts @mention AND photo-tag the artist
  once they've connected their IG.

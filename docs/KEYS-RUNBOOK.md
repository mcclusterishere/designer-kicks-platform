# Keys Runbook — turning on every dormant integration

Every integration ships dormant and flips on the moment its key lands
in Railway (service → Variables → New Variable → paste → the service
redeploys itself). This is the full list in priority order. Time
estimates are for the signup + paste, not review queues.

## 0. First: confirm deploys are actually landing

Before any keys — the footer of every page shows `build <sha>`.
Compare it to the latest commit on GitHub main. If they don't match,
open Railway → the service → Deployments and read the newest deploy's
log; nothing else matters until deploys land.

## 1. Email — RESEND_API_KEY + EMAIL_FROM  (15 min, do this first)

Half the machine talks through email: offer alerts, accepted bids,
commission requests + acceptances, claim handoffs, password resets,
admin notifications. Without it those fire silently into nothing.
1. resend.com → sign up → verify the theheatchart.com domain (add the
   DNS records they show you).
2. API Keys → create → paste as `RESEND_API_KEY`.
3. `EMAIL_FROM` = `The Heat Chart <league@theheatchart.com>`.
4. Also set `ADMIN_EMAIL` = your inbox — submission/commission/sale
   notifications land there.

## 2. eBay — EBAY_CLIENT_ID + EBAY_CLIENT_SECRET (+ EBAY_CAMPAIGN_ID)  (20 min)

Powers the spread (New/Used medians on every OG tile, auto-matched
nightly) and tags item links with your Partner Network campaign.
1. developer.ebay.com → register (free) → Create Application Keyset →
   PRODUCTION keyset.
2. App ID (Client ID) → `EBAY_CLIENT_ID`; Cert ID (Client Secret) →
   `EBAY_CLIENT_SECRET`.
3. partner.ebay.com (your ambassador account) → Campaigns → copy the
   numeric campaign ID → `EBAY_CAMPAIGN_ID`.
4. While you're in EPN: build a generic tracking template and set it
   as `AFF_EBAY_TEMPLATE` so /go outbound links earn too.

## 3. KicksDB — KICKSDB_KEY  (10 min)

The retail/resale leg of the spread + nightly re-pricing of the whole
catalog (the cron is already written; it's dormant without this).
kicksdb.com → account → API key → paste as `KICKSDB_KEY`.

## 4. The cron — CRON_SECRET + cron-job.org  (10 min)

The heartbeat: nightly catalog re-pricing, eBay spread sync, drop-date
sync, battle finalizing.
1. Set `CRON_SECRET` in Railway to any long random string.
2. cron-job.org (free) → three daily jobs, each with header
   `Authorization: Bearer <CRON_SECRET>`:
   - https://theheatchart.com/api/cron/refresh-catalog  (daily — also runs the eBay sync)
   - https://theheatchart.com/api/cron/refresh-drops    (daily)
   - https://theheatchart.com/api/cron/finalize         (hourly)

## 5. Meta — autopost + social login  (30 min + app review wait)

Autopost (approved pieces → FB page + IG) needs:
- `FB_PAGE_ID` = 125181624288884 (your page)
- `FB_PAGE_ACCESS_TOKEN` = long-lived Page token with
  pages_manage_posts + instagram_content_publish (developers.facebook.com
  → your app → Graph API Explorer → generate, then extend to long-lived)
- `IG_USER_ID` = the IG Business account ID linked to that page

Facebook/Instagram login needs (same Meta app):
- `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` (App ID/Secret;
  add valid OAuth redirect: https://theheatchart.com/api/auth/callback/facebook)

Google login: console.cloud.google.com → OAuth client → 
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (redirect:
https://theheatchart.com/api/auth/callback/google).

## 6. EasyPost — EASYPOST_API_KEY  (10 min)

Live shipping quotes on every pending sale (seller + reseller side).
easypost.com → sign up (free tier fine) → API Keys → production key.

## 7. Durable uploads — S3_* (30 min, IMPORTANT before real volume)

Railway disk is ephemeral — artist photos/videos survive restarts only
with object storage. Cloudflare R2 (free 10GB) or AWS S3:
`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
`S3_ENDPOINT` (R2 endpoint if R2), `S3_PUBLIC_URL` (the public base URL).

## 8. Nice-to-haves (whenever)

- `GEMINI_API_KEY` — all the AI assists (autofill, scout, DMs, captions,
  quiz drafts, weekly brief). aistudio.google.com → free key.
- `ANTHROPIC_API_KEY` — the /sell Selling Advisor. console.anthropic.com.
- `GOOGLE_PLACES_API_KEY` — Store Scout zip scans.
- `NEXT_PUBLIC_INSTAGRAM_URL` / `NEXT_PUBLIC_FACEBOOK_URL` /
  `NEXT_PUBLIC_YOUTUBE_URL` — footer social links (hidden until set).

## The 30-second test after each key

- Email: trigger a password reset → it arrives.
- eBay/KicksDB/cron: run the cron URL once by hand with the Bearer
  header → response JSON shows brands/eBay counts > 0 → OG tiles fill.
- Meta: approve any pending piece → it appears on the FB page.
- EasyPost: open a pending sale → quote a lane → real rates.
- S3: upload a piece → the image URL points at your bucket.

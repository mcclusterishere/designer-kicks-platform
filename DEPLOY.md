# Launch Checklist — The Heat Chart

## What it costs (budget path: ~$17 first month, ~$5–7/month after)

| Service | Plan | Cost |
|---|---|---|
| Railway (hosts the app + Postgres) | Hobby | ~$5/month |
| Cloudflare R2 (photo storage) | Free tier (10 GB) | $0 |
| Resend (password-reset emails) | Free tier (3k/month) | $0 |
| Stripe | No monthly fee | 2.9% + 30¢ per sale |
| Google/Facebook sign-in | — | $0 |
| Domain (e.g. Cloudflare or Porkbun) | yearly | ~$10–12/year |

> **Why not Vercel free?** Vercel's Hobby tier prohibits commercial use —
> affiliate links and paid quiz credits make this site commercial, so
> Vercel means Pro at $20/month. Railway (Path B below) is the
> budget-correct host: one service runs the app and the database with a
> persistent disk, and `data/uploads` even works without R2 to start.

Follow this top to bottom and you go from repo → live site. Two solid
paths; pick one:

- **Path A: Vercel + Neon + Cloudflare R2** (serverless, scales with a
  traffic spike, generous free tiers) — recommended for the Facebook
  relaunch.
- **Path B: Railway / Render / VPS** (one server with a persistent
  disk; simpler mental model, uploads can stay on disk).

---

## 1. Database — Neon Postgres (~5 min)

1. Create a free project at <https://neon.tech> (pick a US region close
   to your audience).
2. Copy the connection string (`postgresql://...`).
3. That's your production `DATABASE_URL`.

Run the migrations against it once (locally):

```bash
DATABASE_URL="postgresql://...neon..." npx prisma migrate deploy
DATABASE_URL="postgresql://...neon..." npm run db:seed   # optional demo content
```

The repo ships real migration files (`prisma/migrations/`), so future
schema changes deploy with `npm run db:deploy` — no destructive pushes.

> Supabase Postgres works identically if you prefer it (use the
> "connection pooling" string for serverless).

## 2. Upload storage — Cloudflare R2 (~10 min)

Skip this on Path B (local disk works there) — required on Vercel.

1. Cloudflare dashboard → R2 → Create bucket, e.g. `theheatchart`.
2. Enable public access for the bucket (R2.dev subdomain or a custom
   domain) — copy the public base URL.
3. Create an R2 API token (Object Read & Write) — copy key + secret.
4. Set the env vars:

```
S3_BUCKET="theheatchart"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_PUBLIC_URL="https://<your-public-r2-url>"
S3_REGION="auto"
```

New submission photos now upload straight to the bucket. (AWS S3,
Supabase Storage, and Backblaze B2 all work with the same variables.)

## 3. Deploy the app — Vercel (~10 min)

1. Push this repo to GitHub (done) and import it at
   <https://vercel.com/new>.
2. Framework preset: Next.js — defaults are fine.
3. Add environment variables (Settings → Environment Variables):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `AUTH_SECRET` | run `openssl rand -base64 32` — do NOT reuse the dev one |
| `ADMIN_PASSWORD` | a strong password — **admin login stays disabled until set** |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` |
| `CRON_SECRET` | random string — protects the battle-finalizer cron |
| `S3_*` | the five storage vars from step 2 |

4. Deploy. `vercel.json` already schedules the battle-finalizer cron
   every 10 minutes.
5. Add your domain (Settings → Domains), update `NEXT_PUBLIC_SITE_URL`
   to match, and redeploy.

**Path B instead**: provision a Railway/Render service (or a VPS),
attach a persistent volume mounted at `data/`, set the same env vars,
run `npm run build && npm run db:deploy && npm start`, and schedule
`curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/finalize`
every 10 minutes.

## 4. Email — Resend (~10 min)

Password recovery needs this in production (reset links only go to the
server log without it).

1. Create an account at <https://resend.com>, verify your domain (add
   the DNS records they give you).
2. Set `RESEND_API_KEY` and `EMAIL_FROM="The Heat Chart <noreply@theheatchart.com>"`.

## 5. Payments — Stripe (~15 min)

1. <https://dashboard.stripe.com> → get your **live** secret key →
   `STRIPE_SECRET_KEY`.
2. Developers → Webhooks → Add endpoint:
   `https://yourdomain.com/api/stripe/webhook`, event
   `checkout.session.completed` → copy the signing secret →
   `STRIPE_WEBHOOK_SECRET`.
3. Buy a $1 credit pack yourself end-to-end before announcing.

Until these are set the quiz shows a clearly-labeled dev-mode purchase —
fine for testing, remove before launch by setting the keys.

## 6. Social sign-in — Google & Facebook (~20 min, optional but worth it)

- **Google**: <https://console.cloud.google.com/apis/credentials> →
  OAuth client ID (Web) → authorized redirect URI
  `https://yourdomain.com/api/auth/callback/google` → set
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- **Facebook**: <https://developers.facebook.com> → new app → Facebook
  Login → redirect URI
  `https://yourdomain.com/api/auth/callback/facebook` → set
  `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`. Since your traffic
  IS Facebook, this one meaningfully lifts signup conversion.

Buttons appear automatically once the vars exist.

## 7. Before you post the link

- [ ] `ADMIN_PASSWORD` set (strong), `AUTH_SECRET` fresh, `CRON_SECRET` set
- [ ] Register a real account, vote, play the quiz, buy a $1 pack (live Stripe)
- [ ] Submit a real custom with a real photo — confirm it lands in R2 and the admin queue
- [ ] Replace demo giveaway with your real prize; delete demo content when ready
      (`prisma migrate reset` wipes everything, or remove demo artists in admin)
- [ ] Password reset arrives in an inbox (not spam)
- [ ] **Giveaway rules reviewed by a lawyer** (paid entries + prize = sweepstakes law)
- [ ] `NEXT_PUBLIC_SITE_URL` = the real domain (fixes canonical/OG/sitemap URLs)
- [ ] Submit `https://yourdomain.com/sitemap.xml` in Google Search Console
- [ ] Optional: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` for analytics; add Sentry for error alerts
- [ ] Point the Facebook page at battle URLs and Drop Report articles, not just the homepage

## Scaling notes

- The in-memory rate limiter is per-instance; at real scale move it to
  Upstash Redis (`lib/ratelimit.ts` is the single place to swap).
- Neon autoscales reads fine for this workload; if votes spike, add an
  index review before sharding anything.
- Battle finalization is idempotent — cron + lazy finalization can
  coexist safely.

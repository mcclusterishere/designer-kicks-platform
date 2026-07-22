# Shipping The Heat Chart as a real app

The site is already a PWA (manifest + icons + standalone display +
theme color), which is exactly what the store wrappers consume. Two
paths, both wrap the LIVE site — every deploy updates the app with no
store re-submission.

## 1. Android — Google Play via TWA (half a day, $25 once)

1. https://www.pwabuilder.com → enter `https://theheatchart.com` →
   Package for Stores → Android. It generates a signed Trusted Web
   Activity project (the Play-store-grade wrapper Google themselves
   recommend).
2. Download the package. Keep the generated `assetlinks.json` — commit
   it to `public/.well-known/assetlinks.json` (this proves the app and
   the domain are the same owner, which removes the browser bar).
3. Google Play Console (one-time $25) → Create app → upload the
   `.aab` → fill the listing (use the /dk landing copy + the ad-refs
   screenshots — they're already 1080×1920 store format) → submit.
   Review is typically 1–3 days.

## 2. iOS — App Store via wrapper (a weekend, $99/yr)

1. PWABuilder → same URL → Package for Stores → iOS. It generates an
   Xcode project wrapping the site in a WKWebView shell with your
   icons/splash.
2. Needs a Mac with Xcode + an Apple Developer account ($99/yr). Open
   the project, set the bundle id (org.mccluster.theheatchart), sign
   with your team, archive, upload via Xcode.
3. App Store review note: Apple rejects thin wrappers that add nothing
   over the website ("minimum functionality," guideline 4.2). The app
   clears it by being genuinely app-like — tab navigation, battles,
   games, push-worthy live content. Strengthen the case before
   submitting: enable web push (already PWA-ready), mention the
   Culture IQ game + live voting in the review notes.

## 3. Do these regardless

- `public/.well-known/assetlinks.json` (Android) once PWABuilder
  generates the fingerprint.
- Screenshots: reuse `public/ad-refs/*.png` — real app frames at store
  resolution.
- The store description: the one-liner from /dk — "The stock market
  for custom sneakers. Battles, rankings, live bids."
- Privacy policy URL: https://theheatchart.com/privacy (already live).

## Order of operations

Android first (cheap, fast, no Mac needed), iOS second. Both wrappers
point at production — ship site updates daily without touching the
stores.

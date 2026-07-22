# App Store Kit — everything for App Store Connect

The iOS app itself lives in `ios-app/` (see its README-SUBMIT.md for
the Xcode steps). This file is the copy-paste kit for the listing.

## The honest timeline

- **Apple Developer Program** ($99/yr) — enroll at
  developer.apple.com/programs. Individual enrollment is sometimes
  instant, sometimes 24–48h while Apple verifies identity. Nothing
  ships without it. Enroll as an Organization (McCluster Corp) only if
  you want "McCluster Corp" as the seller name — that path requires a
  D-U-N-S number and takes longer; Individual (Matthew McCluster) is
  the fast lane and can be migrated later.
- **Upload**: ~15 minutes once Xcode has a signed archive.
- **App Review**: typically 24–48 hours, sometimes same-day.
- Realistic: **submitted within hours of the dev account clearing;
  live on the store 1–3 days after submission.** Nobody can promise
  same-night live — that clock is Apple's.

While Apple reviews: the site is already installable tonight — Safari
→ Share → Add to Home Screen gives the full-screen app experience
(the AddToHomeScreen prompt on the site pushes this). Google Play
($25 one-time, review usually under a day) can run in parallel via
docs/APP-SHIPPING.md.

## App Information

| Field | Value |
| --- | --- |
| Name (30 max) | The Heat Chart |
| Subtitle (30 max) | Custom sneaker battle league |
| Bundle ID | com.mcclustercorp.heatchart |
| SKU | heatchart-ios-1 |
| Primary category | Lifestyle |
| Secondary category | Sports |
| Content rights | Does not contain third-party content requiring rights (customs are artist work featured with permission) |
| Age rating questionnaire | Answer **None/No** to every content category (no violence, no gambling — the giveaway is a free sweepstakes with published rules at /rules), unrestricted web access **No** |
| Price | Free |
| Copyright | © 2026 McCluster Corp |
| Support URL | https://theheatchart.com |
| Marketing URL | https://theheatchart.com/drafted |
| Privacy Policy URL | https://theheatchart.com/privacy |

## Promotional text (170 max)

Live battles are on the floor right now. Vote real customs head to
head, watch the Heat Index move, and put your own pair on the record.

## Description

The Heat Chart is the battle league for custom sneakers.

Real one-of-one customs go head to head. The culture votes. Wins write
the record, votes feed the Heat Index, and every artist climbs a
ranking nobody can buy.

THE ARENA
Two customs, side by side. Tap to vote, swipe for more angles, and the
next matchup deals in. Every vote is on the record.

THE MARKET
Customs trade like the assets they are — asks, live bids, sell-now,
and a Heat Index that moves when the culture votes. Artists earn a
royalty on every resale. Forever.

THE HEAT LIST
Every piece and every artist, ranked by wins, votes, and verified
sales. No bought spots.

THE CULTURE
Drop calendars, sneaker news, the Culture IQ game, giveaways, and the
stories behind the makers.

Built by McCluster Corp / Equity Uprise — a home for the artists who
turn blank pairs into grails, and the culture that judges the heat.

## Keywords (100 max, comma-separated)

sneakers,custom,kicks,battles,vote,jordan,dunk,af1,resale,streetwear,heat,collector

## Screenshots

`marketing/app-store/` — five 1290×2796 shots (the 6.7"/6.9" slot,
which App Store Connect reuses for smaller sizes): home, arena voting
deck, market board, standings, the draft pitch. Upload in that order —
the arena deck is the money shot; home first frames the brand.

## App Privacy (nutrition labels)

Data collected, all "linked to you", none used for tracking:
- **Contact Info → Email Address** — app functionality (accounts)
- **Contact Info → Name** — app functionality (display name)
- **User Content → Photos or Videos** — app functionality (submissions)
- **User Content → Other User Content** — app functionality (posts, votes)
- **Usage Data → Product Interaction** — analytics (first-party + GA); mark "not linked to you", no tracking

Answer **No** to "do you or your partners use data for tracking".

## App Review Information

- **Sign-in required**: yes for voting/submitting; browsing is open.
- **Demo account**: create `applereview@theheatchart.com` with a
  strong password on the site BEFORE submitting, then paste those
  credentials into the review notes. (Register normally at
  /register — takes one minute.)
- **Notes for the reviewer** (paste):
  > The Heat Chart is a community battle league for custom sneaker
  > art. Browsing works without an account. The demo account above is
  > signed up as a fan and can vote in live battles (Arena tab),
  > browse the market, and play the trivia game. Purchases/bids are
  > handled on the website per our marketplace terms; the app does not
  > sell digital goods or use in-app purchase. The giveaway is a free
  > sweepstakes with rules at theheatchart.com/rules.

## Known review risks, called straight

1. **Guideline 4.2 (minimum functionality)** — web-wrapper apps get
   flagged when they feel like "just a website." Working for us: the
   site is genuinely app-shaped (tab bar, deck voting, games), the
   shell handles external links natively, and category peers (StockX,
   GOAT communities) set expectations. If rejected: the standard cure
   is adding a native layer — push notifications for battle results is
   the natural one — and resubmitting. That's a planned v1.1 anyway.
2. **Guideline 4.8 (third-party login)** — we offer email/password
   alongside Facebook login, which usually satisfies it. If a reviewer
   pushes back, the fast fix is hiding the Facebook button when the
   HeatChartApp user agent is present (the shell already sends
   `HeatChartApp/1.0` in its UA for exactly this kind of switch);
   Sign in with Apple is the durable fix later.
3. **Giveaway (5.3 contests)** — rules page exists and states no
   purchase necessary; link it in review notes if asked.

## Submission order of operations (tonight's checklist)

1. Enroll / confirm Apple Developer Program membership. ← the gate
2. appstoreconnect.apple.com → My Apps → **+ New App** → iOS, name
   "The Heat Chart", bundle id `com.mcclustercorp.heatchart`, SKU
   `heatchart-ios-1`, language English (U.S.).
3. Fill App Information + Privacy from this file; upload the five
   screenshots; paste description/keywords/promo text.
4. Create the `applereview@` demo account on the site; fill App Review
   Information with it.
5. On the Mac: archive + upload per `ios-app/README-SUBMIT.md`.
6. When the build finishes processing, select it on the version page →
   **Add for Review → Submit**.
7. Watch email: Apple's status notifications (In Review → Ready for
   Sale) land there. Expedited review exists (one-time plea at
   developer.apple.com/contact/app-store/?topic=expedite) if there's a
   hard launch date.

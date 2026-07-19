# Affiliate Program Playbook — The Heat Chart

Affiliate revenue is how the platform sustains itself and funds the
program's work with artists — this is the signup roadmap for every
outbound buy link on the site: the Market page, the Where-to-Buy strips
on drop sheets, and the buy links inside articles. All of them route
through `/go`, which logs the click (see **Market Pulse** in /admin) and
applies your affiliate tag automatically.

## How links get paid (do this once per program)

You do NOT edit links one at a time. When a program approves you, it
gives you either a **deep-link template** (Impact-style:
`https://xxx.pxf.io/c/YOURID/.../...?u={url}`) or **tracking
parameters** (eBay-style: `&campid=XXXX&toolid=10001`). Paste it into
the matching Railway variable and *every* link for that merchant —
site-wide, past and future — starts paying instantly:

| Railway variable | Merchant |
|---|---|
| `AFF_STOCKX_TEMPLATE` | StockX |
| `AFF_GOAT_TEMPLATE` | GOAT |
| `AFF_EBAY_TEMPLATE` | eBay |
| `AFF_ETSY_TEMPLATE` | Etsy |
| `AFF_KICKSCREW_TEMPLATE` | KicksCrew |
| `AFF_STADIUMGOODS_TEMPLATE` | Stadium Goods |
| `AFF_GRAILED_TEMPLATE` | Grailed |
| `AFF_FLIGHTCLUB_TEMPLATE` | Flight Club |
| `AFF_FOOTLOCKER_TEMPLATE` | Foot Locker |
| `AFF_FINISHLINE_TEMPLATE` | Finish Line |
| `AFF_JDSPORTS_TEMPLATE` | JD Sports |
| `AFF_END_TEMPLATE` | END. |
| `AFF_AMAZON_TEMPLATE` | Amazon |
| `AFF_ANGELUS_TEMPLATE` | Angelus Direct |
| `AFF_RESHOEVN8R_TEMPLATE` | Reshoevn8r |
| `AFF_CREP_TEMPLATE` | Crep Protect |
| `AFF_JASONMARKK_TEMPLATE` | Jason Markk |
| `AFF_LACELAB_TEMPLATE` | Lace Lab |
| `AFF_UNDEFEATED_TEMPLATE` | UNDEFEATED |

Template rules: a value containing `{url}` (encoded) or `{plain}` (raw)
REPLACES the destination — use this for Impact/Sovrn deep links. A value
starting with `&` or `?` APPENDS parameters — use this for eBay campid
or Amazon `&tag=yourtag-20`.

Per-product link swaps in **/admin → Shop Products → Edit** still work
for one-off cases, but the env template is the tool for the job.

> ⚠️ Rates below come from affiliate directories and merchant pages as of
> July 2026. Exact rates are only visible inside each network dashboard
> after approval — verify before publishing rate claims. Items marked
> *unverified* couldn't be confirmed from two independent sources.

## Start here (fastest path to a fully-monetized shop)

1. **FlexOffers** — <https://www.flexoffers.com/> — one signup (24–48h
   approval) unlocks Stadium Goods, Flight Club, Grailed, Crep Protect,
   Sneakersnstuff, Champs, Finish Line, JD Sports, and ASOS. Best
   beginner move; they take a cut, so migrate top earners to direct
   programs later.
2. **eBay Partner Network** — <https://partnernetwork.ebay.com/> — easy
   approval, instant links, good for rare/vintage pairs. 24-hour cookie
   is the drawback.
3. **Amazon Associates** — <https://affiliate-program.amazon.com/> —
   covers all the accessories (crease protectors, shoe trees, display
   cases, Jason Markk). **Deadline: 3 qualifying sales in your first 180
   days or the account closes** (you can reapply).

## Marketplaces (the hype pairs)

| Program | Network / Signup | Commission | Cookie |
|---|---|---|---|
| StockX | Impact — <https://stockx.com/news/stockx-affiliate-program/> | ~2–3% | 15 days |
| GOAT | Impact / Sovrn — <https://commerce.sovrn.com/merchants/145356/goat-affiliate-program> | ~2% *(unverified)* | *unverified* |
| Flight Club | FlexOffers / AvantLink | ~1.6–2% | 30 days |
| Stadium Goods | FlexOffers / Skimlinks | ~4% | 30 days |
| KicksCrew | Impact / CJ | ~4–5% (best marketplace rate) | 30 days |
| eBay | eBay Partner Network | 1–4% by category | 24 hours |
| Etsy | Awin — <https://www.awin.com/us/publishers/etsy> | ~2–4% | 30 days |
| Grailed | FlexOffers — <https://www.grailed.com/drycleanonly/grailed-affiliate-program> | ~1–2.2% *(unverified)* | ~15 days |

## Retail (new releases)

| Program | Network / Signup | Commission | Cookie |
|---|---|---|---|
| Foot Locker | Impact (US) — <https://www.footlocker.com/affiliates.html> | ~2% | 30 days |
| Finish Line | via Skimlinks/Sovrn/FlexOffers — <https://www.finishline.com/store/corporate/affiliateProgram.jsp> | ~3.5–4% | 30 days |
| JD Sports | Rakuten (US) — <https://www.jdsports.com/store/corporate/affiliateProgram.jsp> | ~5% | 30 days |
| Champs | Impact / FlexOffers — <https://www.champssports.com/affiliates.html> | ~2% | 30 days |
| Nike | Awin (UK) / CJ–Rakuten (US) | ~4–7% (Nike By You customs included) | 30 days |
| adidas | Impact (US) — <https://www.adidas.com/us/help/us-company-information/what-is-our-affiliate-program> | ~3–7% | 30 days |
| New Balance | Impact | ~2–7% tiered | 30 days |
| END. Clothing | Impact — <https://www.endclothing.com/us/affiliate-program> | up to ~10% | 7 days |
| Sneakersnstuff | FlexOffers / Sovrn | ~6% | *unverified* |
| ASOS | Awin / Rakuten / FlexOffers | up to 6–7% new customers | ~30–45 days |

## Customizer supplies (your core audience!)

| Program | Network / Signup | Commission | Notes |
|---|---|---|---|
| **Angelus Direct** | In-house/Refersion — <https://angelusdirect.com/pages/referralprogram> | ~10–11% *(unverified)* | THE paint brand for customizers. Portal status unclear — open the page in a browser; if closed, email them directly (they actively partner with customizer creators). |
| Reshoevn8r | In-house — <https://reshoevn8r.com/pages/affiliate-program> | up to 20% | Ambassador tier is open to anyone; Influencer tier needs ~10k followers. |
| Crep Protect | In-house/FlexOffers — <https://crepprotect.com/pages/affiliate-sign-up> | 10–20% tiered | 30-day cookie. |
| Lace Lab | Refersion — <https://lacelab.refersion.com/> | 20% | No coupon sites / paid ads to their domain. |
| Get Laced Laces | In-house — <https://getlacedlaces.com/pages/affiliate-program-for-sneaker-accessories> | *unverified* | Lace alternative. |
| Kingsland Shoe Project | In-house — <https://thekingslandshoeproject.com/pages/affiliate> | *unverified* | Shoe trees. |
| Jason Markk | **No direct program** | ~4% via Amazon | Link their products through Amazon Associates. |
| Sneaker LAB / The Lab | **No public program** | — | Recently rebranded; sell via Amazon links for now. |

## Aggregators (auto-convert links)

- **FlexOffers** — the practical starting point (see above).
- **Skimlinks** — <https://www.skimlinks.com/> — one JS snippet converts all
  merchant links sitewide; keeps 25%; often rejects brand-new sites.
- **Sovrn Commerce** — <https://www.sovrn.com/commerce/> — similar model,
  hosts GOAT/Flight Club/Stadium Goods/Grailed.

## Things to know before applying

- Almost every direct program (StockX, GOAT, Nike, adidas, END., Foot
  Locker) **manually reviews your site** — they want real content and
  traffic. Launch the site, post battles for a few weeks, point the
  Facebook page at it, *then* apply. Nike is the hardest approval.
- **Etsy runs on Awin**, and Awin charges a ~$5 signup deposit that is
  refunded with your first payout. Etsy is worth it for this site — the
  audience literally commissions custom sneakers there, and the Market's
  Etsy card deep-links to the custom-sneaker search.
- Programs run **per-region** on different networks (Awin UK vs
  Impact/Rakuten US). Apply in the region your traffic comes from.
- Avoid AliExpress/Temu for this audience — counterfeit sneakers will
  torch the page's credibility with sneakerheads.
- Name collisions: "Goat USA" and "Goat Fashion" are NOT goat.com.
- The FTC requires affiliate disclosure — already built into the site
  footer and the Shop page. Keep it if you redesign.

## How to swap in your links

1. Get approved → grab your tagged link from the network dashboard.
2. Go to `/admin` → Shop Products → **Edit** on the product.
3. Paste the tagged link into the "Affiliate link" field → Update.

That's it — the shop card now pays you.

---

_The Heat Chart is a project of McCluster Corp / Equity Uprise._

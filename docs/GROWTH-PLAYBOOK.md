# THE GROWTH PLAYBOOK — The Heat Chart

**Written 31 July 2026.** Every capability below traces to a doc URL. Anything the verification pass could not confirm is tagged inline — treat tagged items as probes, not build tickets.

**Ranking rule used throughout:** site traffic (goal 1) beats shoe sales (goal 2) beats on-page interaction (goal 3), divided by build effort. Interaction still matters — it is the fuel — but a mechanic that only raises comment counts ranks below one that moves people to theheatchart.com.

---

## 1. THIS WEEK — no permission, no review, no account change

Twelve mechanics, ranked. Effort is rough dev-days for one person who already knows this codebase.

### TIER 1 — the traffic taps (build in this order, ~4 days total)

**1. URL buttons on every outbound DM** — *0.5 day. The single highest-value gap in the stack.*

Mechanic: attach a `web_url` button template to every message the bot sends, so a DM ends in a tappable "Vote now" / "Cop this pair" instead of a pasted link.

Why it compounds: this is the literal click that satisfies goal 1, and right now it does not exist. `lib/metaEngage.ts:412` (`sendDmReply`) and `:472` (`sendPrivateReply`) build only `{ text, quick_replies }` — no `attachment` branch. Every comment-to-DM private reply, every flow node, every share thank-you currently terminates in text. Add button support once and the entire existing funnel converts to click-through overnight, with `?ref=`/UTM params flowing into `lib/traffic.ts`. Nothing else in this list has a better ratio.

Doc: https://developers.facebook.com/docs/messenger-platform/reference/buttons/url/ — *"The URL Button opens a webpage in the Messenger webview. This button can be used with the Button and Generic Templates."*

Note: no domain whitelisting needed for a plain `web_url` button. Whitelisting only enters when `messenger_extensions` is turned on (see #10).

---

**2. Persistent Menu** — *0.5 day. Free permanent storefront in thousands of threads.*

Mechanic: pin an always-on menu to every Messenger conversation with the Page — "Vote in today's battle", "Shop customs", "Drop calendar", "Enter the giveaway" — each a `web_url` to theheatchart.com.

Why it compounds: it is retroactive and permanent. Every person the comment-to-DM funnel has ever touched gets it the moment it is set, and every future entrant inherits it. One POST to `/me/messenger_profile`, and `lib/chatbot.ts:897` (`installMessengerProfile`) already writes to exactly that endpoint with `get_started` + `greeting` + `ice_breakers` — add a `persistent_menu` key to the same body and it ships.

Doc: https://developers.facebook.com/docs/messenger-platform/send-messages/persistent-menu/ — *"The Persistent Menu allows you to have an always-on user interface element inside Messenger conversations. This is an easy way to help people discover and access the core functionality of your Messenger bot at any point in the conversation."* (New canonical path: https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/persistent-menu)

Prereq already met: a Get Started button must exist first — it does (`lib/chatbot.ts:905`).

---

**3. Link posts with real preview cards** — *1 day. The workhorse of goal 1.*

Mechanic: publish battle/drop/game posts with the `link` parameter so each one is a full tappable card to theheatchart.com; because the domain is the operator's own, verify it in Business Manager and the preview image/title become per-post API parameters.

Why it compounds: it turns every Page post from a dead-end image into a door, and per-post card art is A/B-testable against the same URL without editing site OG tags. `lib/social.ts:85` (`postToFacebookPage`) is where it lands.

Doc: https://developers.facebook.com/docs/graph-api/reference/page/feed/ — *"The link must be owned by the posting Page."* … *"To verify link ownership, check the ownership_permissions{can_customize_link_posts} field on the URL node. You must call this endpoint before posting new links. Without this step, custom link Page posts will not work for un-scraped links."*

**Operational trap:** that precheck call is mandatory per new link, not optional. Build it as a step in the publish path, not a manual chore.

---

**4. m.me links with `?ref=`** — *1 day (mostly caption plumbing).*

Mechanic: caption every poll post with `m.me/theheatchart?ref=battle_<id>`, giveaway posts with `ref=heat_giveaway`, drop posts with `ref=drop_<sku>` — the ref lands on the webhook so the bot opens with the exact matchup the person came from.

Why it compounds: it is the attribution spine for everything else. Without it, DM traffic is anonymous; with it, every downstream click is traceable to a post. Since the Chat Plugin is dead (see section 5), m.me is the only sanctioned site-to-Messenger and post-to-Messenger bridge left. The webhook parser already handles referrals — `lib/metaEngage.ts:192` reads mid-conversation `?ref=` arrivals.

Doc: https://developers.facebook.com/documentation/business-messaging/messenger-platform/discovery/m-me-links — *"An m.me link can contain a ref parameter that, when a person clicks on the link, provides your business with more context about the conversation. ... The app linked to your business' Facebook Page must be subscribed to the messaging_postbacks and messaging_referrals webhooks fields."*

Confirm both webhook fields are subscribed. META-SETUP.md line 263 lists Page fields as `feed`, `messages`, `mention` — `messaging_postbacks` and `messaging_referrals` are **not listed** and must be added.

---

**5. Ice Breaker retune** — *0.25 day. Already installed, just wrong content.*

Mechanic: point the four slots at traffic doors — "What's dropping this week?" → drop calendar, "How do I enter the HEAT giveaway?" → giveaway flow, "Can I buy custom kicks?" → shop, "Who's winning today's battle?" → battle page — each answer ending in a URL button (which needs #1 first).

Why it compounds: it is first-touch. Someone who opens a thread and never types still becomes a site session.

Doc: https://developers.facebook.com/docs/messenger-platform/reference/messenger-profile-api/ice-breakers/ — *"Ice Breakers on Messenger API now supports localization allowing businesses to set custom ice breakers depending on the user locale."*
**[SOFT]** That exact sentence was confirmed only from a search-index snippet, not a raw fetch — the doc page is live and the locale-keyed format is independently confirmed in current SDKs, so the capability is real even if the wording is near-verbatim.

---

### TIER 2 — reach and cadence (~1 week)

**6. Instagram Collaborator Tags** — *1 day. The cheapest audience-borrow available.*

Mechanic: add the featured roster artist as `collaborators` when publishing battle and spotlight posts — once they accept, the single post appears on both profiles and reaches both audiences.

Why it compounds: it is free borrowed distribution that scales with the roster. Every new artist onboarded permanently widens the reach of every post they appear in. Lands in `lib/metaPublish.ts:168` (`publishToOwnInstagram`).

Doc: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media — *"collaborators — For Feed image, Reels and Carousels only. A list of up to 3 instagram usernames as collaborators on an ig media. Not supported for Stories."*

Creator account is fine — no business gate found on collaborator tagging. Collaborator must be public with collaborator tagging enabled, and must accept (in-app, or via `POST /{ig-user-id}/collaboration_invites` from their own authorized account — the publisher cannot force it). Check status with `GET /{ig-media-id}/collaborators`. Verified against a 2025-12-14 mirror of the live docs.

---

**7. Instagram user tags** — *0.5 day. Complements #6.*

Mechanic: tag both artists in every "which shoe: 1/2/3" post — their work is literally in the image — with x/y coordinates on photos.

Why it compounds: each tagged artist gets a notification, and the post lives permanently in their profile's Tagged tab where their followers browse. Use it for the second and third artists when only one can be the collaborator.

Doc: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/ — *"An array of public usernames and x/y coordinates for any public Instagram users who you want to tag"*, x/y floats 0.0–1.0 from top-left, *"Tagged users will receive a notification when the media is published."*

Constraints: tagged accounts must be public; photos require x/y, plain videos take username only, videos inside carousels are not supported. Ceiling: *"Instagram accounts are limited to 100 API-published posts within a 24-hour moving period. Carousels count as a single post."*

---

**8. Scheduled posts** — *1 day. Turns the autoposter into a calendar.*

Mechanic: `published=false` + `scheduled_publish_time` to queue a week of link posts at fan-peak hours.

Why it compounds: consistent daily cadence without daily human effort, and it pairs with the held-but-unused `read_insights` to place posts when fans are actually online. Read the queue back with `GET /{page-id}/scheduled_posts`.

Doc: https://developers.facebook.com/docs/graph-api/reference/page/feed/ — *"scheduled_publish_time — UNIX timestamp indicating when post should go live. Must be date between 10 minutes and 75 days from the time of the API request."*

**Correction to earlier planning:** the window is 10 minutes to **75 days** for feed posts, not ~29 days. The ~30-day ceiling belongs to Reels (see #9), not feed.

---

**9. Reels publishing to the Page** — *2 days (render pipeline is the cost, not the API).*

Mechanic: three-phase upload to `/{page-id}/video_reels` — auto-render the week's top battle into a vertical clip with a "vote on the next one at theheatchart.com" description.

Why it compounds: Reels is the surface Meta is actively shifting distribution toward, and the same rendered asset feeds IG Reels through the existing pipe (`lib/social.ts:163`, `postToInstagramReel`). One render, two surfaces.

Doc: https://developers.facebook.com/docs/video-api/guides/reels-publishing/ — flow: `upload_phase=start` → returns `video_id` + `upload_url`; upload binary (or `file_url`); `upload_phase=finish` with `description` and `video_state=PUBLISHED` (or `DRAFT` / `SCHEDULED` + `scheduled_publish_time`). Live sample: github.com/fbsamples/reels_publishing_apis.

Three gotchas confirmed from 2026 production integrations: (a) omit `video_state=PUBLISHED` on finish and the reel silently stays a draft; (b) Reels scheduling caps around 30 days, not 75; (c) the older `fbsamples/Facebook-Reels-Publishing-API-Postman-Collection` repo was archived July 2023 — its 60s max is outdated, current specs are roughly 4–90s, 9:16, min 540x960.

---

**10. oEmbed Heat Chart posts back into theheatchart.com** — *1 day. Now the safest bet in the set.*

Mechanic: embed the live FB poll post on top of each battle page, artist IG posts on roster pages, the daily Threads post on the feed.

Why it compounds: it runs the loop backwards. Embedded posts keep native Like/Share chrome, so site visitors push the Facebook post back up in ranking — site traffic feeding post reach feeding site traffic.

Doc: https://developers.facebook.com/docs/instagram-platform/oembed/ — as of Meta's 15 June 2026 reversal: *"The Meta oEmbed APIs for Instagram, Facebook, and Threads can now be called without an access token, and App Review is no longer required ... Now you can hit the endpoints directly with no token, no review, and no developer account."*

This vindicates the META-SETUP.md decision to skip the oEmbed use case (line 161-170). One operational requirement: *"Tokenless access may come with lower rate limits than the token-based route"* — server-side fetch and cache the returned HTML per URL, revalidate on a slow timer. Public content only.

---

### TIER 3 — worth doing, lower ratio (~1 week)

**11. Messenger webview + Extensions SDK** — *2 days.* Battle pages open full-height inside Messenger; the user votes on theheatchart.com without visibly leaving the thread, then `requestCloseBrowser()` drops them back into the flow. Counts as real site traffic and session data. Requires adding theheatchart.com to `whitelisted_domains` in the Messenger Profile (same call as #2) and the SDK script on site pages.
Doc: https://developers.facebook.com/docs/messenger-platform/webview/ — *"To display a webpage with the Messenger Extensions SDK enabled in the Messenger webview you must whitelist the domain, including sub-domain, in the whitelisted_domains property of your bot's Messenger Profile."*

**12. Facebook Page Stories** — *1.5 days.* Daily "today on the chart" cards, drop countdowns, giveaway reminders via `/{page_id}/photo_stories` and `/{page_id}/video_stories`. Facebook-side only — untouched by the Instagram account-type question.
Doc: https://developers.facebook.com/docs/page-stories-api/
**Two constraints that reshape the render spec:** *"Facebook Stories do not support post text — any text provided will be ignored"* (every word must be burned into the pixels), and *"A video story cannot exceed 60 seconds."* Also *"A photo or video uploaded for a story cannot have been used in a previously published post."* No link-sticker parameter is documented — the CTA lives in the image plus the Page's own button.

**13. Organic post targeting** — *0.5 day build, but test first.* Geo-gate the giveaway to shippable regions with `targeting.geo_locations` (cleans up the DM-HEAT giveaway legally and kills junk entries), age-gate resale posts with `targeting.age_min`, and soft-bias battle posts to the sneaker demo with `feed_targeting`.
Doc: https://developers.facebook.com/docs/graph-api/reference/page/feed/ — *"targeting — Object that limits the audience for this content. Anyone not in these demographics will not be able to view this content."* / *"feed_targeting — Object that controls Feed Targeting for this content. Anyone in these groups will be more likely to see this content, those not will be less likely, but may still see it anyway."* `age_min` accepts only 13, 15, 18, 21, 25.
**[NEEDS LIVE TEST]** Meta removed the Preferred Audience UI years ago, and `geo_locations` inside `feed_targeting` was not re-confirmed in the current reference capture. Run one live test post per parameter before the giveaway's legal compliance depends on it.

**14. Business Discovery for outreach scoring** — *1 day.* Pull `followers_count` and real engagement on any prospect artist or partner store before DMing, to rank the Outreach and Store Scout queues and personalize the pitch.
Doc: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery/ — query shape `GET /{ig-user-id}?fields=business_discovery.username({target}){followers_count,media_count,media{comments_count,like_count}}`. Subject to Platform rate limiting, not Business Use Case limiting. Target must be a professional account.
**[PROBE FIRST]** No App Review feature gate was found in any current mirror, but META-SETUP.md line 355 flags the evidence as mixed and prescribes one cheap experiment. Also: it needs `instagram_manage_insights` in the token, and a missing scope returns `(#10) Application does not have permission for this action` — which reads like a review problem and is not one.

**15. Live Video — immediate broadcasts only** — *1 day.* `POST /{page-id}/live_videos` returns an RTMPS `secure_stream_url` for OBS. Run the Battle Finale reveal live, pin theheatchart.com in the description, let the comment bot carry links. Weekly recurring lives become appointment traffic.
Doc: https://developers.facebook.com/docs/features-reference/live-video-api/ — review is required only *"If your app will be used by anyone without a Role on the app"*, so own-Page streaming runs on Standard Access. Gate confirmed: account at least 60 days old and Page with at least 100 followers, effective 10 June 2024 — META-SETUP.md line 227 records both as cleared.
**Do not build around scheduled broadcasts** — see section 5.

**16. Page CTA button rotation** — *probe only, do not schedule build work.* The idea (cron-rotate the Page button between shop, giveaway, and drop pages) is right, but `pages_manage_cta` is **not held** and the capability could not be verified.
**[UNVERIFIED]** Run one Graph Explorer probe against the live Page first. Build the rotation only on a 200. If it fails, the fallback is changing the button by hand in Meta Business Suite — a 30-second human action that does not justify a permanent permission on the annual renewal ledger (META-SETUP.md lines 21-32 on why every added permission is a forever cost).

**17. Page mention handling — with a fallback** — *0.5 day.* The `mention` webhook field is real, correctly named, and already subscribed (META-SETUP.md line 263).
**[UNRELIABLE]** Multiple Meta developer-community threads report Page mention webhooks silently not firing (https://developers.facebook.com/community/threads/2037492463297342/, https://developers.facebook.com/community/threads/792249535832215/). Do not promise "reply within minutes" off it — subscribe `feed` and detect the mention there as the fallback, which is where the community converged.
**Drop the "as seen on Facebook" social-proof rail** built on `GET /{page-id}/tagged`: that edge could not be confirmed to exist in current Graph versions, and its last substantive documentation required `manage_pages`, a permission that was itself deprecated at v7.0. An edge whose documented permission is a dead permission is very likely unmaintained. Build the rail from oEmbed (#10) instead — post URLs you already know, no gated read at all.

---

### Sizing the existing comment-to-DM funnel

The private-reply engine is already built. The limits are now pinned, and they change how it should be run:

- *"Private replies are currently allowed within 7 days of the referenced user action."*
- Rate limit: **750 calls per hour** per Instagram professional account for private replies (100/sec for replies to Live comments).

At high comment volume, 750/hour is the real throughput constraint — not a daily cap. Queue private replies through a rate-limited worker rather than firing on webhook receipt, and prioritize first-time commenters. Since only one private reply per comment is ever permitted, that single message must carry the URL button (#1). A second message is only possible if the person replies — which then opens a normal 24-hour window for the chatbot. As `lib/metaEngage.ts:466` already notes in a comment: the private reply itself does not open the window; only their answer does. So the text has to earn a reply, not just deliver a link.

---

## 2. UNLOCKED BY APP REVIEW — one bundled submission

### Clear the runway first (this is blocking, today)

Per META-SETUP.md lines 68-83: **an App Review submission is already open and blocking all other submissions.** `can_submit: false` — *"Cannot submit to App Review while a previous submission is in review."* The open one is **Marketing API Access Tier**, with three incomplete steps (`use_case`, `api_precheck`, `data_use_checkup`).

That submission was never necessary. Marketing API Access Tier is a rate-limit upgrade; managing the operator's own ad account works on Standard Access. **Either finish its three steps or withdraw it — nothing below can be filed until it clears.**

Also blocking: **Privacy Policy URL is NOT SET** on App 1 (META-SETUP.md line 65). App Review requires it. Set it to `https://theheatchart.com/privacy`.

Already done and worth knowing: **business verification PASSED** (META-SETUP.md line 63). That was the long pole. Compliance is clean, zero violations.

### The one bundle — everything below ships or dies together

| What | What it buys | Doc |
|---|---|---|
| **Advanced Access, `pages_messaging` + `instagram_manage_messages`** | The whole thing. Today the private-reply funnel only reaches people with a role on the app. This is what lets it serve the 300k-follower audience. Nothing else in this table matters without it. | META-SETUP.md line 287 |
| **Human Agent feature** | The 7-day manual reply window — the sales-closing tool for goal 2. When a buyer asks about a custom pair and the operator is asleep, a human reply 2-6 days later is still sanctioned. `lib/metaEngage.ts:452` already has the tag wired with a policy-safe fallback, so approval flips it on with no redeploy. **Human replies only — no automated content under this tag, ever.** | https://developers.facebook.com/docs/features-reference/human-agent — *"This tag allows businesses to respond to user messages on Messenger and Instagram manually outside the 24-hour standard messaging window up to 7 days. ... Use of tags outside of approved use cases may result in restrictions on your ability to send messages."* |
| **IG DM link buttons (button + generic templates)** | Upgrades the "DM HEAT" flow and IG private replies from pasted links to a swipeable card carousel — live battle cards and shop shoes, each with a "Vote now" / "Cop this pair" button. | https://developers.facebook.com/docs/messenger-platform/instagram/features/generic-template — *"A generic template with multiple templates described in the elements array will send a horizontally scrollable carousel of items, each composed of an image, text and buttons."* … *"Supported button types are postback and web_url."* |
| **Story Mentions webhook** | Fans who repost a battle result to their story tagging the account get an instant DM thank-you with a link button and a bonus entry code. Every story mention — currently invisible to the stack — becomes a DM and a site visit. Mentioning account must be public (or private and followed); mention media CDN URLs expire around 7 days. | https://developers.facebook.com/docs/messenger-platform/instagram/features/story-mention/ **[SOFT]** — the doc page 403-blocked the verification sandbox; the capability is corroborated by Meta's webhooks docs and partner-relayed rules, not a raw fetch of the page body. |
| **Instagram webhooks generally (`comments`, `mentions`, `live_comments`)** | The read/reply calls work at Standard Access on own media, but the *webhooks* do not. Current doc: *"Apps must be set to Live in the App Dashboard to receive webhook notifications. ... Advanced Access is required to receive comments and live_comments webhook notifications. ... The Instagram professional account that owns the media objects must be public to receive notifications for comments or @mentions."* | https://developers.facebook.com/docs/instagram-platform/webhooks **[MIRROR-VERIFIED]** — developers.facebook.com blocked the sandbox; confirmed via current-doc mirrors. |
| **Mentions API — reply on strangers' media** | `POST /{ig-user-id}/mentions` posts a reply comment on someone else's post that @mentioned the account — visible to their whole audience. The only sanctioned way to reply publicly on a stranger's media. Also the recruiting hook: an uncontacted customizer who tags the Page gets an auto-invite to claim their artist profile. | https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/mentions/ |
| **Instagram Public Content Access feature** | Hashtag Search — the weekly artist-scouting radar across #customsneakers, #customkicks, #sneakerartist. **This is a FEATURE, not a permission** — there is no hashtag permission, and holding `instagram_basic` is not enough. Cap: *"IG Users can query a maximum of 30 unique hashtags within a rolling, 7 day period."* Media objects omit usernames on media you don't own, so recruiting means opening permalinks by hand — sanctioned, not scraping. Lowest-priority item in the bundle; not a launch feature. | https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/hashtag-search/ **[MIRROR-VERIFIED]** |

**Two review-free workarounds while this is pending:**

1. The Mentions loop runs today by **polling** `mentioned_media` on a cron instead of waiting for the webhook — the reply edge itself works at Standard Access on the operator's own account.
2. The `feed` webhook field catches Page mentions that the `mention` field drops (see #17).

**One architectural warning carried forward** (META-SETUP.md lines 371-380): shared permissions (`public_profile`, `business_management`, `pages_show_list`, `pages_read_engagement`, `ads_management`) are required across many use cases at once. Raising any of them from Standard to Advanced propagates across every use case that shares them and can pull new review requirements onto use cases never meant for submission. Keep App 1 on Standard Access wherever possible; consider moving the editor Facebook-Page connect flow to App 3.

### Beyond review — the paid tier (needs a business portfolio + ad account with billing)

Not part of the review bundle, but this is where the ceiling is:

- **Marketing Message API for Messenger** — the replacement broadcast channel, and the single biggest site-traffic weapon available. Every giveaway DM and every private reply becomes an opt-in ask; a high-comment funnel could build a five-figure subscriber list, then push "New battle is LIVE" sends whose buttons land on theheatchart.com. Requires: full Page access + at least one ad account with a credit card under the same Meta Business Portfolio, Business-type app with Advanced Access, Facebook Login for Business, and **paid per send**. Cadence ceiling: *"The 'subscription_token' message sending cooldown changed from allowing one send per subscriber every 24 hours to one send every 48 hours."* Opt-in expires after ~6 months, which makes the giveaway loop the natural re-opt-in engine.
  https://developers.facebook.com/documentation/business-messaging/messenger-platform/marketing-messages-on-messenger/faq
- **Utility Messages (templates)** — order confirmed / shipped / delivered, sent outside the 24-hour window, each carrying a button back to the order page plus a "while you wait, vote in this week's battle" path. Turns fulfillment into repeat visits. Same infrastructure as above; non-promotional content rules strictly enforced.
  https://developers.facebook.com/docs/messenger-platform/send-messages/utility-messages/
- **One-Time Notification API (Beta)** — the free version, and it works *today* inside the HEAT flow at Standard Access for app-role users: "Notify me when the winner is announced" banks a token, redeeming it is the traffic event. *"The token can only be used once and expires within 1 year of creation."* Enabled via Page Settings → Advanced Messaging, a Page-level toggle, not App Review. **[CONFIRM IT STILL FIRES]** — given that every sibling capability was purged in 2026, send one test notification before building deep on it.
  https://developers.facebook.com/docs/messenger-platform/send-messages/one-time-notification/
- **Ads that Click to Messenger** — the scale lever when spending starts. The referral webhook carries `ad_id` and `ads_context_data`, so the first message deep-links to the exact battle or product the ad showed. Requires `messages` + `messaging_referrals` subscriptions. Running ads on your own Page through Ads Manager needs no review.
  https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/messages/

---

## 3. SWITCHING INSTAGRAM FROM CREATOR TO BUSINESS

### What actually changes

**Gained:**
- Eligibility for the **Upcoming Events API** — but only as a stepping stone, and a poor one. It requires a Business-linked professional account *plus* a new permission `instagram_manage_upcoming_events` (not held) *plus* ad spend, because the doc states the API is *"Intended to facilitate the creation of reminder ads."* Verbatim limitations: *"Only supports Instagram Professional accounts linked to a Business. Currently only supports retrieval of events created via Ads Manager or this API."*
  https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/upcoming-events **[MIRROR-VERIFIED, 2025-12-14]**
- **Product tagging / commerce surfaces** and **API Stories publishing** — documented as business-account-only.
  **[CARRIED FORWARD, NOT RE-VERIFIED]** These two are the gates recorded from an earlier verification pass; this sweep did not re-fetch the commerce and Stories-publishing docs to confirm the account-type language still reads that way in July 2026. Re-verify before making the switch on their account.

**Lost or at risk:**
- **`facebook_creator_marketplace_discovery`** is currently held (mock data pending App Review). Creator Marketplace eligibility is a creator-account surface. **[UNVERIFIED]** — whether switching to Business forfeits it was not confirmed; check before switching.

**Unchanged — everything that matters most works on creator today:**
- Collaborator tags (#6) — publishing docs explicitly cover "businesses and creators"; no business gate found
- User tags (#7)
- Business Discovery (#14) — doc covers Business and Creator
- Hashtag Search (section 2) — doc says Business and Creator
- Mentions API (section 2) — covers "Instagram Business or Creator"
- Instagram Messaging (section 2) — *"Instagram Messaging is now available for any Instagram Professional account for a business or a Creator."*

### Verdict: not worth it now

The switch buys two things: product tagging and API Stories publishing. Both are weaker than they look.

**Stories** are already available on the Facebook side today with no account change at all (#12) — `/{page_id}/photo_stories` and `/{page_id}/video_stories` do not touch any Instagram account-type restriction. The story surface is not blocked; only the *Instagram* story surface is.

**Product tagging** requires a product catalog and Instagram commerce approval regardless of account type — the account switch is the first of several gates, not the last. And the shop already sells through theheatchart.com, which is goal 1's destination anyway; tagging products in IG posts sends people to Instagram's checkout, not the operator's site. That works against the ranked goals.

**Reminder ads** are the one genuinely interesting thing on the far side, and they cost money, need a permission the app doesn't have, and only work as paid campaigns. The free version of that idea — battle and drop countdowns — is buildable now from theheatchart.com plus a scheduled link post plus a Reel.

**Revisit when:** the shop's volume justifies an Instagram commerce integration on its own merits, or reminder-ad spend becomes part of the budget. Not before.

---

## 4. THE FUNNEL MAP

Every hop from a stranger seeing a poll post to a shoe sold. Bracketed labels are the powering capability. `[REVIEW]` = needs the section-2 bundle. `[PAID]` = needs ad account with billing.

```
                        ┌─────────────────────────────────────────┐
                        │  STRANGER SCROLLING FACEBOOK / INSTAGRAM │
                        └────────────────────┬────────────────────┘
                                             │
        ┌────────────────────────────────────┼────────────────────────────────────┐
        │                                    │                                    │
   [Scheduled posts]                  [Collaborator tags]                   [Reels publishing]
   [Link posts w/ card]               [IG user tags]                        [Page Stories]
   [Organic targeting]                        │                                    │
        │                                     │                                    │
   POLL POST                          ARTIST'S AUDIENCE                      REELS / STORIES
   "which shoe: 1/2/3"                sees the same post                     high-reach surface
   caption: m.me/…?ref=battle_42      under both names                       CTA burned in pixels
        │                                     │                                    │
        └────────────────┬────────────────────┴────────────────────────────────────┘
                         │
      ┌──────────────────┼──────────────────┬──────────────────────┐
      │                  │                  │                      │
   COMMENTS          TAPS m.me LINK      SHARES               @MENTIONS US
   "2!!"             ?ref=battle_42      the post             in comment / story
      │                  │                  │                      │
 [Comment webhook]  [messaging_referrals] [share webhook]   [Mentions API] [REVIEW]
 [AI reply, post-    [m.me ?ref=]         [thank-you DM]     [Story mention] [REVIEW]
  context aware]          │                  │                      │
      │                   │                  │                      │
 PUBLIC REPLY on the      │                  │              PUBLIC REPLY on THEIR post
 comment (interaction     │                  │              → their whole audience sees it
 fuel, goal 3)            │                  │                      │
      │                   │                  │                      │
 [Private reply]          │                  │                      │
 750/hr ceiling ──────────┴──────────────────┴──────────────────────┘
 1 per comment, ever
 7-day window
      │
      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        MESSENGER / IG DM THREAD                           │
│                                                                           │
│  [Ice Breakers] first-touch questions ──► flow                            │
│  [Persistent Menu] always visible: Vote · Shop · Drops · Giveaway         │
│  [Quick Replies] "Which shoe takes it? 1 / 2 / 3"  (≤13, 20 chars)        │
│  [Gemini fallback] anything the flow graph doesn't match                  │
│  [Generic template carousel] battle cards + shop cards  [REVIEW on IG]    │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            [URL button]              [Messenger webview
            web_url + UTM + ?ref       + Extensions SDK]
                    │                  full-height, votes
                    │                  in-sheet, then
                    │                  requestCloseBrowser()
                    │                         │
                    └────────────┬────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          THEHEATCHART.COM                                 │
│   ═══════════════════════ GOAL 1 SATISFIED ═══════════════════════        │
│                                                                           │
│   battle page  ·  artist closet  ·  drop calendar  ·  games  ·  shop      │
│   [oEmbed] the FB poll post embedded here — native Like/Share chrome      │
│            pushes the post back up FB ranking (loop closes)              │
│   [lib/traffic.ts] first-party attribution: which post, which flow node   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
                          SHOE PURCHASED  ══ GOAL 2 ══
                                 │
                    ┌────────────┴────────────┐
                    │                         │
         [Utility Messages] [PAID]    [Human Agent tag] [REVIEW]
         order confirmed →             buyer asks a question at 2am,
         shipped → delivered,          operator answers 3 days later —
         each with a button back       still sanctioned, still sells
                    │                         │
                    └────────────┬────────────┘
                                 ▼
                    "while you wait, vote in
                     this week's battle" ──────┐
                                               │
                    [Marketing Message API]    │
                    [PAID] opt-in banked ──────┤
                    twice-weekly "new battle   │
                    is LIVE" pushes            │
                                               │
                    [One-Time Notification]    │
                    free, 1 msg/token:         │
                    "notify me when the        │
                     winner drops"             │
                                               ▼
                                    BACK TO THEHEATCHART.COM
                                    (repeat visitor, goal 3 → 1 → 2)
```

**Where the funnel currently leaks:** the arrow marked `[URL button]` does not exist yet. Everything upstream of it is built and running; everything downstream depends on it. That is why it is item #1.

---

## 5. WHAT DOES NOT EXIST — do not chase these

**Dead by deprecation:**

| Ghost | Reality | Source |
|---|---|---|
| **Recurring Notifications** (free opt-in broadcast) | Retired 7 Jan 2026, discontinued globally 10 Feb 2026 except AU/EU/JP/KR/UK. Any RN code written now will error. Migration path is the Marketing Message API. | https://www.facebook.com/business/help/1321849029608125 — *"On February 10, 2026, Recurring Notifications via the Messenger API will be discontinued globally except for AU, EU, JP, KR, and the UK."* |
| **Message tags** `CONFIRMED_EVENT_UPDATE`, `POST_PURCHASE_UPDATE`, `ACCOUNT_UPDATE` | Dead as of 27 Apr 2026 — sends return error 100. Order updates move to Utility Messages; promotional nudges to Marketing Messages. | https://developers.facebook.com/docs/messenger-platform/changelog/ — *"Effective April 27, 2026 all API requests containing the deprecated Message Tags ... will receive error code 100."* |
| **Customer Chat Plugin** (website widget) | Fully deprecated 9 May 2024; install capability removed 9 Apr 2024. Legacy code shows broken widgets. Use m.me links instead. | https://developers.facebook.com/docs/messenger-platform/discovery/facebook-chat-plugin/ — *"features such as m.me links remain available for use."* |
| **Sponsored Messages** | Creation removed from Marketing API v20.0, May 2024. Budget moves to Marketing Messages + CTM ads. | https://developers.facebook.com/docs/messenger-platform/changelog/ |
| **Live Shopping** (product playlists / tagging in lives) | Shut down 1 Oct 2022. A Battle Finale live cannot tag products — the CTA has to be spoken, pinned in the description, and carried by the comment bot. | https://9to5mac.com/2022/08/03/facebook-live-shopping-discontinued/ |
| **Groups API** | Removed 2024. No API path into Facebook Groups. | META-SETUP.md line 443 |
| **Posting to personal Facebook profiles** | Removed 2018. No permission restores it. | META-SETUP.md line 441 |
| **Messenger webview payments** | Deprecated 2017/18. The webview itself is alive; payments inside it are not — checkout stays on theheatchart.com. | https://developers.facebook.com/docs/messenger-platform/webview/ |

**Never existed, or exists only in the app:**

| Ghost | Reality |
|---|---|
| **A "Remind me" chip on organic Instagram posts** | The consumer-facing Add Reminder is an in-app manual feature with **no API surface**. No `upcoming_event_id` — or any event parameter — exists on the `/{ig-user-id}/media` publishing container; confirmed absent from the full ig-user/media and ig-container references as of Dec 2025. The Upcoming Events API only feeds paid Instagram Reminder Ads. This funnel is not buildable. |
| **Tagging users in Facebook Page posts** | No API for it. Instagram tagging works (#7); Facebook tagging does not. (META-SETUP.md line 447) |
| **A second private reply to the same comment** | One per comment, ever, enforced by Meta. The one message has to carry the button. |
| **Cold DMs / bulk outreach** | The 24-hour window is structural. All outbound automation is reactive by design and by house rule. |
| **Scraping anything** | Business Discovery and Insights are the sanctioned data lanes. Hashtag Search deliberately omits usernames on media you don't own — the recruiting step is a human opening a permalink. |

**Contested — treat as absent until a live call proves otherwise:**

| Ghost | The contradiction |
|---|---|
| **Scheduled live broadcasts** (`status=SCHEDULED_UNPUBLISHED` + `planned_start_time`) | Meta's guide still publishes it — *"POST /{node-id}/live_videos?status=SCHEDULED_UNPUBLISHED&planned_start_time={start-time}"*, capped at *"up to seven days from their creation date."* But Meta's own v12.0 changelog says: *"Scheduling a live video is deprecated for v12.0 and will be deprecated for all versions on December 14, 2021. Calls to the POST /ID/live-video endpoint with the planned_start_time parameter will return an error."* Two Meta docs, opposite answers. **Do not build the countdown product on the Meta-scheduled broadcast object.** Drive the countdown from theheatchart.com, announce with an ordinary scheduled link post plus a Reel, and create the live video immediately at go-time. Rehearse into an unpublished broadcast rather than a pre-dated one. https://developers.facebook.com/docs/live-video-api/guides/scheduling/ vs https://developers.facebook.com/docs/graph-api/changelog/version12.0 |
| **`GET /{page-id}/tagged`** | Could not be confirmed to exist in current Graph versions. Its last substantive documentation required `manage_pages` — a permission deprecated at v7.0 and split four ways. An edge documented against a dead permission is very likely unmaintained. If it did resolve, reading strangers' content at scale lands in Page Public Content Access — Advanced Access, business verification, possibly extra contracts. **Do not assume `pages_read_user_content` covers it.** Build the social-proof rail from oEmbed instead. |
| **`pages_manage_cta` / Page CTA button API** | Permission not held; the capability's documentation could not be verified. Probe once, build only on a 200, and take the Business Suite fallback otherwise (#16). |

---

## HOUSE RULES THAT APPLY TO ALL OF THE ABOVE

From CLAUDE.md, non-negotiable on every item in this playbook:

1. **Read the provider docs before writing code** for any of these — including the ones cited here. This document is a plan, not a spec; parameter names and limits get re-verified at build time.
2. **All outbound automation is REACTIVE and capped.** Nothing here initiates contact with someone who hasn't acted first. The caps in this document are conservative self-imposed floors, not doc-derived ceilings — loosen them only with a documented limit in hand.
3. **HUMAN_AGENT is reserved for a real person typing at the desk.** No automated content under that tag, ever, regardless of what it would unlock.
4. **`npm run verify:meta`, `verify:chatbot`, `verify:purge`, and `npm run build`** all pass before any commit touching `lib/` or `app/`. New Meta-facing behavior gets new checks in the same pass.
5. **Every permission added is an annual renewal cost** — 60-day clock, no extensions, app deactivated if missed (META-SETUP.md lines 21-32). Add what you will use. Not-adding is cleaner than add-then-remove.

**Where the work lands:** `/home/user/designer-kicks-platform/lib/metaEngage.ts` (buttons, private replies, webhook parsing), `/home/user/designer-kicks-platform/lib/chatbot.ts` (persistent menu, ice breakers, whitelisted domains — extend `installMessengerProfile` at line 897), `/home/user/designer-kicks-platform/lib/social.ts` (link posts, scheduling, targeting, Reels), `/home/user/designer-kicks-platform/lib/metaPublish.ts` (collaborator tags, user tags), `/home/user/designer-kicks-platform/lib/autopost.ts` (the content calendar), `/home/user/designer-kicks-platform/lib/traffic.ts` (attribution).
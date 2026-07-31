# Comment Intelligence Upgrade — Implementation Spec

**Target:** `/home/user/designer-kicks-platform` (Next.js 16 / TypeScript / Prisma). Facebook Page "The Heat Chart" + Instagram Creator.
**Touches:** `lib/metaEngage.ts`, `lib/chatbot.ts`, `lib/shoeVision.ts`, `lib/gemini.ts`, `lib/sneakerApi.ts`, `prisma/schema.prisma`, `scripts/verify-meta.ts`, `scripts/verify-chatbot.ts`, `scripts/verify-purge.ts`, new `app/api/meta/data-deletion/route.ts`.
**Status of prior art:** post classification (`describePost`), the four-kind `PostKind`, `situationBlock`, and `condenseThread` already exist and ship today. This spec is mostly *extension*, not greenfield. The `photo` slot in `situationBlock` already exists and is **hardcoded to `null` at `lib/chatbot.ts:685`** — that is the single wire this whole feature lights up.

---

## 1. WHAT IS ACTUALLY POSSIBLE

### Blocked — do not build until cleared

**B1. Sending a commenter's photo to Gemini is a Platform Terms violation on the current API key.**
Meta's Platform Terms define Platform Data as "any information, data, or other content you obtain from us… **including data anonymized, aggregated, or derived from such data**." A Gemini-generated sneaker description is therefore itself Platform Data. Sharing Platform Data with a third party is permitted only in four enumerated cases; the applicable one is "with your Service Provider in order for them to provide the services you requested" — and that requires the provider to **"first agree in writing"** to process it "solely for you and at your direction… and for no other purpose, **including for the Service Provider's own purposes**."

Google's **unpaid** Gemini API tier uses prompts and images to improve Google products. That is the Service Provider's own purpose. Using an unpaid key here violates the clause outright.

This is not confined to the new feature. `describePost()` already sends the Page's own post photo, and the thread brief already quotes other users' comment text into the prompt — both are Platform Data going to the same provider. **The blocker is retroactive on code that is already live.**

Remediation, all of which must be done before a single comment photo is transmitted:
- Enable Cloud Billing on the Gemini project (per Google's terms, this reclassifies usage as a Paid Service for data-use purposes even where the service is free of charge), or move to Vertex AI. *This exact sentence is `[unverified]` in the dossier — `ai.google.dev` was 403 all session. The owner must read https://ai.google.dev/gemini-api/terms from an unblocked network and confirm it before relying on it.*
- Have the Google Cloud Terms + Cloud Data Processing Addendum in place and **retain proof**. Whether click-through terms satisfy "agrees in writing" is a legal call, not an engineering one.
- Be able to produce, on Meta's request, a list of Service Providers with data types and volumes plus proof of written agreements. Meta may unilaterally prohibit any Service Provider.

**Code gate (required, ship in step 1):** a new env var `META_SERVICE_PROVIDER_ATTESTED=1`. `lib/gemini.ts` gains an exported `platformDataAllowed(): boolean` that returns `Boolean(process.env.META_SERVICE_PROVIDER_ATTESTED)`. Every call path that puts Meta-sourced content (post photo, post caption, comment text, comment photo) into Gemini checks it first and degrades to the non-AI path when false. The flag is an attestation the owner sets by hand; it does not verify anything, and its doc comment must say so.

**B2. Google Search grounding cannot be used anywhere on this feature. Four independent disqualifications, none curable in code.**
Google's Service Specific Terms restrict Grounding with Google Search to "a Customer Application that is **owned and operated by the Customer**" and require grounded results be displayed "**only… to the End User who submitted the prompt**." A Facebook comment thread is owned by Meta and is public. Separately: "will not **modify, or intersperse any other content with**, the Grounded Results" — the entire product concept is wrapping an identification in banter. Separately: "will not… **cache**, frame, syndicate, resell, **analyze**, train on, or otherwise learn from Grounded Results… using Links to **build an index**" — writing an identified sneaker into the catalog is the named prohibited pattern. Separately, `searchEntryPoint.renderedContent` is an HTML/CSS blob that must be displayed and cannot render inside a Facebook comment.

Combining a JSON response schema with `google_search` reportedly returns `webSearchQueries` populated but `groundingChunks` and `groundingSupports` **empty** — you would pay for grounding and be structurally unable to render the citations the licence requires. Structured output is not a workaround.

**Live exposure in this repo:** `lib/sneakerApi.ts:246` — `fromGemini()` passes `search: true`, and it is the last rung of `lookupSneaker()`. If the photo path calls `lookupSneaker()` it will silently reach a grounded call whose output gets persisted to the catalog. **`lookupSneaker` must gain an opt-out and the photo path must use it.** (`app/actions.ts:4113,4129,4224` also use `search: true`; those are admin tools, out of scope here, but they persist results and deserve their own pass.)

**B3. Instagram is out of scope for the photo feature, permanently.**
The IG Comment node has no `attachment` field (complete modelled field set: `id, hidden, from, like_count, media, text, timestamp, user, username, parent_id, legacy_instagram_comment_id, replies`), and its `media` field is the **parent post**, not an attachment. The IG comments webhook value carries only `id, from, media, text, parent_id`. There is no IG image to fetch. Any code that reads `attachment` must be behind `platform === "facebook"`.

**B4. Building a per-person picture of what shoes someone owns needs consent.**
"Processing Platform Data without valid User consent in order to build or augment user profiles for any purpose" is a Prohibited Practice. A per-commenter sneaker-collection memory is exactly that. The photo read must be **analyse → reply → forget**: no cross-comment aggregation keyed on `fromId`, no "you showed me your 4s last week."

**B5. The bot cannot tag or @-mention the commenter.**
The API does not permit mentioning personal profiles; only Pages may mention Pages, via `message_tags` with a Page ID and character offsets. Literal `@Name` text does not resolve. Address people in plain unlinked text. Do **not** reach for `facepile_mentioned_ids` — it exists in the generated SDK spec but its semantics and permission requirements are entirely undocumented in anything reachable, and mention-spam is a known restriction trigger.

**B6. The hourly caps are invented, not documented — keep them that way.**
No Meta document states any number of comments per hour or per day. The Spam standard's only frequency language is "at very high frequencies," with an explicit rider that lower frequencies are also restricted "when other indicators of Spam (e.g., posting repetitive content) or signals of inauthenticity are present." `PUBLIC_REPLY_HOURLY_CAP` (default 30) and `SHARE_THANKS_HOURLY_CAP` (default 12) are conservative self-imposed floors. **They may not be raised citing documentation, because no documentation exists to cite.**

### Constrained but buildable

**C1. Rate limit is the real ceiling and it scales with engagement.** Page-token calls are limited per Page: `Calls within 24 hours = 4800 * Number of Engaged Users`, 24h sliding window, **shared across every app using that Page token** (schedulers, inbox tools, analytics all draw from it). On a quiet day the budget is small; a viral post spikes call volume against a budget computed on the trailing window. Error code **32** is returned when throttled, and **calls made while throttled still count toward subsequent limit calculations** — retrying on 32 extends the block indefinitely. Error 32 must trip a hard circuit breaker, never a backoff-and-retry.

**C2. Disclosure.** Meta's own business-messaging policy already requires telling users they are talking to an automated service at the start of a thread. EU AI Act Article 50 entered full force **2 August 2026**; a Facebook Page is EU-reachable by default. I found **no** Meta rule requiring AI-labelling of *text* replies from a Page (Meta's shipped labelling targets photorealistic image/video) — but that is a search-based negative, not a confirmed absence. Safe posture: disclose unconditionally on the DM surface; carry a light automation signal on public replies.

**C3. `HUMAN_AGENT` stays unreachable from automation.** Already correctly enforced in `metaEngage.ts` — do not touch that boundary.

### Fully supported

1. **Non-shoe posts** — already shipping. `describePost()` returns `off-topic` with a `topic` sentence, and `situationBlock()` already emits the "do not steer to sneakers" instruction. Needs a fifth category (§2) and better triggering, not a rebuild.
2. **Reading the surrounding thread** — supported. `GET /{post-id}/comments` accepts exactly four typed params (`filter`, `live_filter`, `order`, `since`); field expansion pulls post + comments + replies + reaction summaries in one request. Replies on **Facebook** live at `/{comment-id}/comments` (Instagram uses `/replies` — the conflation this codebase has already been burned by).
3. **User photo on a comment** — supported on Facebook only. `Comment.attachment` (**singular**; `attachments` plural is the *Post* edge) is typed `StoryAttachment`, image at `attachment{media{image{src,width,height}}}`, extra media at `subattachments`, kind discriminated by `type` and `media_type`.
4. **Naming an obscure pair via web search** — **not** via Gemini grounding (B2). Fallback is the existing KicksDB-backed catalog plus an ungrounded `lookupSneaker`, and if that fails, a reply that compliments without naming. Cloud Vision Web Detection ($3.50/1,000, no display or caching restrictions) is a viable later option but is a *new Service Provider* and re-triggers the B1 written-agreement duty.

---

## 2. POST CLASSIFICATION

### Where it lives
`lib/shoeVision.ts` → `describePost(platform, postId): Promise<PostBrief | null>`. Already implemented, already cached, already one model call per post. This section specifies the deltas.

### Categories

`PostKind` becomes a five-member union (currently four):

| kind | meaning | reply frame |
|---|---|---|
| `poll` | Two or more shoes labelled with numbers/letters, pick one. Comments are votes. | Name the pick using `lineup`, react to it, one question back. Multi-vote callout allowed. |
| `photo-prompt` | The post asks people to post **their own** photo: favourite pair, least favourite, current rotation, latest cop. | Never ask them to pick a number. Expect attachments. This is the category that arms the §4 path. |
| `shoe-talk` | Sneakers, but no labelled lineup and no photo ask. One pair, a release, a custom, a restock. | No voting language. No "which one." |
| `off-topic` | Not about sneakers. Holiday, milestone, meme, announcement. | Talk about `topic` and nothing else. No sneakers, no site, no giveaway. |
| `sensitive` | **NEW.** Loss, illness, injury, memorial, a serious news event, anything where a joke is a liability. | Brief, warm, sincere. No GIF. No question. No giveaway. Prefer SKIP entirely. |
| `null` (not a kind) | Brief unavailable: no caption, no image, Gemini off, call failed, unparseable. | Existing default branch: "we could not read this post… do not assume it is a poll." |

`sensitive` is a genuine safety category, not a taxonomy nicety: a bot that asks "which pair are you actually wearing" under a condolence post is the single worst thing this feature can do. It must be a first-class classification, not a hope that `off-topic` produces tact.

### How the classification is produced

One `geminiJson()` call per post, image part **before** text part (Google's stated best practice for single-image prompts), `temperature: 0.2`, **no tools ever**. Extend `VISION_SYSTEM` with the `sensitive` definition and require the model to prefer `sensitive` over `off-topic` whenever it is unsure whether a post is sombre.

Return shape, unchanged plus one field:

```ts
export type PostKind = "poll" | "photo-prompt" | "shoe-talk" | "off-topic" | "sensitive";
export type PostBrief = {
  kind: PostKind;
  topic: string | null;    // one plain sentence, sliced to 300
  lineup: string | null;   // "1 = Air Jordan 4 Bred; 2 = Dunk Low Panda", polls only
  expectsPhotos: boolean;  // NEW: true for photo-prompt, and for any post whose
                           // caption asks for a picture even when kind lands elsewhere
};
```

Keep the existing hardening: an unrecognised `kind` string falls to `shoe-talk`, never `poll` — the poll frame is the one that reads worst when wrong. Extend that rule: an unrecognised kind on a post whose caption matches `/\b(rip|rest in (peace|power)|passed away|condolence|funeral|hospital|surgery|memorial)\b/i` falls to `sensitive`, not `shoe-talk`. That regex is a cheap deterministic backstop under the model, not a replacement for it.

### Caching — one model call per post, not per comment

Unchanged mechanism, and it is correct: module-level `briefCache: Map<postId, {brief, at}>`, TTL `12h`, max 300 entries, FIFO eviction, **negative results cached too** so a dead post is not re-read once per commenter. Railway runs a single long-lived process, which is what makes a module map honest here.

Three rules to preserve or add:
- **Do not persist the brief to Postgres.** The `topic` sentence is Gemini-derived from a Meta post, i.e. Platform Data under B1's derived-data clause. In-memory with a 12h TTL is the cleanest retention story available and requires no deletion machinery.
- Cache the *failure* as `null` with the same TTL (already done). A Gemini outage during a viral post must not become 400 retries.
- If the app ever runs more than one process, this becomes N calls per post per process, not one. Acceptable at N=1. Revisit before scaling; do not "fix" it with a database table without re-reading B1.

**Cost:** 1 Gemini call + (via `fetchPostContext`, separately cached 6h) 1 Graph call, per post per 12h.

---

## 3. THREAD CONTEXT

### The call

One field-expanded request per post per TTL window, against the **post** node:

```
GET {FB_API}/{post-id}
  ?fields=comments.filter(toplevel).order(chronological).limit(50)
          {id,message,from,created_time,like_count,comment_count,is_hidden,
           comments.limit(5){id,message,from,created_time,like_count}}
         ,comments.limit(0).summary(true).as(all_comments)
         ,reactions.type(LIKE).limit(0).summary(true).as(like)
         ,reactions.type(LOVE).limit(0).summary(true).as(love)
         ,reactions.type(HAHA).limit(0).summary(true).as(haha)
         ,reactions.type(WOW).limit(0).summary(true).as(wow)
         ,reactions.type(SAD).limit(0).summary(true).as(sad)
         ,reactions.type(ANGRY).limit(0).summary(true).as(angry)
         ,reactions.type(CARE).limit(0).summary(true).as(care)
         ,reactions.type(FIRE).limit(0).summary(true).as(fire)
         ,reactions.type(HUNDRED).limit(0).summary(true).as(hundred)
         ,reactions.type(PRIDE).limit(0).summary(true).as(pride)
         ,reactions.type(THANKFUL).limit(0).summary(true).as(thankful)
  &access_token={page-access-token}
```

Field-by-field provenance:
- `filter` enum is exactly `stream | toplevel`; `order` enum is exactly `chronological | reverse_chronological`. Both verified against three independently generated official SDKs. **`ranked` is not a valid value** — anything in this codebase sending `order=ranked` is stale. There is no `until` companion to `since`.
- **The behavioural meaning of `stream` vs `toplevel` is UNVERIFIED.** Only the spellings are confirmed. Do not assume `toplevel` suppresses replies until you have probed it (§9).
- Facebook replies are the `/comments` edge of the **comment**; the nested `comments.limit(5){...}` above is that edge reached by expansion. Instagram uses `/replies`. Never share this code path with IG.
- Reaction enum is **twelve** values: `ANGRY, CARE, FIRE, HAHA, HUNDRED, LIKE, LOVE, NONE, PRIDE, SAD, THANKFUL, WOW`. Any hardcoded six-reaction map silently drops buckets, and **FIRE is likely the most-used reaction on a sneaker Page** — dropping it would make the sentiment signal actively wrong. `NONE` is not requested.
- The aliased `.type(X).limit(0).summary(true).as(x)` breakdown syntax is verified from shipped third-party code, not from Meta docs. Each alias returns its own `summary.total_count`.
- `summary.total_count` is documented as **approximate** and varies with privacy settings. Use it only as a "there are more than we can see" signal. **Never** use it as the vote tally.
- `limit(0)` as "summary only" is community practice, not documented. If it misbehaves, `summary=total_count` is the doc-sanctioned form.
- **Maximum `limit` on the comments edge is UNVERIFIED.** Do not hardcode 100 or 500. 50 is chosen as a self-imposed floor; probe the ceiling before raising it.
- Permission: reading engagement on the Page's own posts is covered by `pages_read_engagement` + `pages_read_user_content`, both already granted. Meta: "For apps that have been granted the pages_read_engagement and pages_read_user_content permissions, only data owned by the Page is accessible" — which is exactly this use case. *The verbatim permission-reference text could not be read (403); this rests on a search-surfaced quote.*

### New module surface

Add to `lib/metaEngage.ts`:

```ts
export type ThreadComment = {
  id: string;
  message: string | null;
  fromId: string | null;
  fromName: string | null;
  createdTime: string | null;
  likeCount: number;
  replyCount: number;      // Facebook's per-comment reply count is `comment_count`,
                           // NOT `reply_count` — that field does not exist.
  isHidden: boolean;
  isOurs: boolean;         // from.id === FB_PAGE_ID
  replies: ThreadComment[];
};
export type ReactionCounts = Partial<Record<
  "like"|"love"|"haha"|"wow"|"sad"|"angry"|"care"|"fire"|"hundred"|"pride"|"thankful", number>>;
export type ThreadSnapshot = {
  comments: ThreadComment[];
  totalComments: number | null;   // approximate
  reactions: ReactionCounts;
  fetchedAt: number;
  partial: boolean;               // true when the expanded read failed and we fell back
};

export async function fetchThreadSnapshot(
  platform: string, postId: string
): Promise<ThreadSnapshot | null>;
```

Rules inside it:
- `platform !== "facebook"` → return `null` immediately. Do not attempt the IG shape.
- Tolerate every field being absent. Graph errors on unknown *requested* fields, so if the full expansion 400s, retry **once** with a minimal `fields=comments.limit(25){id,message,from,created_time}` and set `partial: true`. If that fails too, return `null` — the reply proceeds without thread context, exactly as it does today.
- `from` can be restricted or omitted on visitor comments depending on permissions. A missing `from` must not be read as "this is a visitor." Treat missing `from` as unknown, and never as ours.
- Skip `is_hidden === true` comments entirely; they were moderated for a reason.
- **Do not paginate.** No documented deep-pagination cap exists, and no documentation confirms one does not. One page of 50 is the whole budget.

### Cache

`threadCache: Map<postId, {snap, at}>`, module-level, TTL **10 minutes**, max 200 entries, FIFO, negative results cached for 2 minutes. Ten minutes is a deliberate tension: fresher than the post cache because a running tally goes stale, coarse enough that a 200-comment burst costs one call. Same in-memory-only rule as §2 for the same B1 reason.

### Merging with the bank we already have

`SocialVote` already banks every comment that arrives by webhook — that is the *authoritative* tally (deterministic `parseVoteChoice`, no model, dedup on `commentId`). The Graph snapshot adds three things the bank cannot have: comments that predate the bot going live, replies (which never fire a top-level webhook we bank), and our own past replies.

Rewrite `condenseThread` (currently `lib/chatbot.ts:470`, pure and exported — keep both properties) to take both sources:

```ts
export function condenseThread(input: {
  banked: ThreadRow[];              // SocialVote rows: rawText, choiceLabel, shoeName, commentId
  fetched: ThreadComment[] | null;  // Graph snapshot comments, flattened with replies
  reactions: ReactionCounts | null;
  totalComments: number | null;
  exceptCommentId: string | null;
  sampleSize?: number;              // default 6
}): string | null;
```

Merge order and rules:
1. Dedupe by `commentId` / `id`; the banked row wins because it carries `choiceLabel` and `shoeName`.
2. Drop the comment being answered (`exceptCommentId`) and drop anything where `isOurs`.
3. **Tally comes from `banked` only.** A fetched comment with no banked row contributes to "how many people are talking," never to "option 2 has 14." Guessing a vote from a comment we never parsed would make the tally silently wrong, which is worse than a small tally.
4. Keep the existing "fewer than 2 other voices is not a conversation → return null" guard.

Output paragraph (extends the current three lines):

```
41 other people have commented on this post.
Running count: Air Jordan 4 Bred (1) has 14, Dunk Low Panda (2) has 9, 6 said something without picking.
The post's reactions are running: 88 like, 31 fire, 12 love, 4 haha.
Some of what people are saying: "2 all day", "breds or nothing", "panda is played out", ...
We have already replied to 3 people under this post. Do not reuse these openings: "that midsole paint is clean", "...".
Use this to judge the mood and to avoid repeating what we already said to somebody else.
```

The reactions line is the only sentiment signal the documentation actually supports. **There is no sentiment API.** Do not invent a sentiment score from comment text with a second model call — it would double the per-post Gemini spend to produce a number nothing verifies. Emit raw counts, in descending order, top four only, and let the model read the room. Omit the line entirely when every count is zero or the reactions read failed.

The "do not reuse these openings" line is new and comes from `isOurs` comments in the fetched snapshot — first 60 chars of each of our last three replies under this post. It is the cheapest available fix for the bot repeating one joke down a thread.

### API call budget per incoming comment

| | Graph calls | Gemini calls | CDN fetches |
|---|---|---|---|
| Text comment, post cached (steady state) | **0** | 1 (the reply) | 0 |
| Text comment, cold post | 2 (post context + thread) | 2 (brief + reply) | 1 (post image) |
| Photo comment, post cached | **1** (comment node read) | 2 (photo ID + reply) | 1 (comment image) |
| Photo comment, cold post | 3 | 3 | 2 |

Steady state on a 200-comment viral post: 2 Graph calls per 10 minutes for context (~24 in two hours) plus 1 per photo comment, plus the reply POSTs, which are bounded by `PUBLIC_REPLY_HOURLY_CAP=30`. That is the design target and it is what keeps this inside a small Page's budget.

### Rate-limit circuit breaker (required, not optional)

`graph()` in `lib/metaEngage.ts` currently discards response headers. Change it to read `X-Page-Usage`, `X-App-Usage`, `X-Business-Use-Case-Usage` and record the max of `call_count`, `total_cputime`, `total_time` into a module-level `usage: {pct: number, at: number}`.

- `pct >= 80` → **skip optional reads**: no thread snapshot, no comment-attachment read, no post brief refresh. Replies still go out from cached context. Log once per minute, not per call.
- `pct >= 95` → **stop all outbound writes** (`replyToComment`, `sendPrivateReply`, `likeObject`) for the rest of the hour. The Engagement desk sees the events untouched.
- **Error code 32 → hard stop.** Set a module-level `throttledUntil = Date.now() + 60*60*1000` and refuse every Graph call until it passes. **No retry, no exponential backoff** — rejected calls still count toward the next window, so a retry loop extends the block indefinitely.
- `X-Business-Use-Case-Usage.estimated_time_to_regain_access`, when present, overrides the one-hour guess.

Whether a single field-expanded request bills as one call or several against the Page budget is **UNVERIFIED** — the existence of `total_cputime` and `total_time` as separately throttled dimensions strongly suggests an expanded query costs more even if `call_count` increments once. Measure the delta (§9) before trusting the budget table above.

---

## 4. USER PHOTO IDENTIFICATION

Facebook only. `platform !== "facebook"` exits at the top of every function in this section.

### 4.1 Detection

**Do not branch on the webhook.** The feed change value has historically carried a top-level `photo` key holding a direct `scontent` CDN URL — but the only fixtures proving it are from 2017 (their own URLs expired in 2017), a 2026 third-party schema omits it, another 2026 production codebase still reads it, and Meta's primary docs were unreachable all session. Verdict: **opportunistic only.** If `value.photo` is a non-empty string, keep it as a *hint* that a fetch is worth attempting; never treat its absence as "no photo," and never fetch it as the authoritative asset.

The same defensive posture applies to the whole feed value:
- `value.post` (the sub-object with `status_type, is_published, updated_time, permalink_url, promotion_status, id`) was observed in captures from Sept 2023 and June 2024 and is still modelled as required by a Nov 2025 third-party schema — but it is undocumented in any reachable Meta source, at least one production parser ignores it entirely, and the only capture proving it is of an unpublished promoted post. **Null-guard it everywhere.**
- The parser must **tolerate unknown keys without throwing.** The one thing the 2024 capture definitively proves is that extra undocumented keys do arrive.
- Do not code against `sender_id` / `sender_name`. Those are retired; the current shape is a nested `from: {id, name}`, which `parseWebhookPayload` already reads correctly.

Authoritative detection is a Graph read of the comment node, gated on:
```
platform === "facebook"
  && event.kind === "comment"
  && platformDataAllowed()                       // B1 gate
  && (postBrief?.expectsPhotos || !event.text || value.photo)   // don't read every comment
  && rateLimitUsage.pct < 80
```
The third clause is the cost control: read the attachment when the post asked for photos, when the comment has no text at all (a photo-only comment is otherwise invisible), or when the webhook hinted. On a text-heavy poll post this stays at zero extra calls.

### 4.2 Retrieval

```
GET {FB_API}/{comment-id}
  ?fields=id,message,from,created_time,attachment{type,media_type,title,description,url,
          unshimmed_url,target,media{source,image{src,width,height}},
          subattachments{data{type,media_type,target,media{source,image{src,width,height}}}}}
  &access_token={page-access-token}
```

- **`attachment` is SINGULAR.** Verified in Meta's own Node, Python, and PHP Business SDKs (`attachment: 'attachment'` in the Comment Fields enum). The plural `attachments` is the **Post** edge — requesting it on a comment ID returns nothing. Conflating them is a known bug class.
- `Comment.attachment` is typed `StoryAttachment`, exposing `description, media, media_type, target, title, url, unshimmed_url, subattachments, description_tags` plus `type` and `id` inherited from `FacebookType`. Image URL is at `media.image.src`, with `media.image.height/width`; `media.source` carries video/media source.
- `subattachments` is a container of further `StoryAttachment` objects — "a multi-photo story will have a parent attachment representing an upload of multiple photos… where each subattachment will contain the actual photos."
- **The assembled request path above is `[unverified]`.** Every individual field name is verified from generated SDK source; the assembly is construction, and no documented example request was reachable. Treat a 400 as expected on first run: implement a degrade to `fields=id,message,from,attachment{media_type,media{image{src}}}` and log the original error verbatim so the field list can be narrowed against the real API. The `subattachments{data{...}}` nesting in particular is my construction; the dossier only confirms `subattachments{data}`.
- **Do not send `attachment` on a create/update call.** Writing uses `attachment_url` / `attachment_id` / `attachment_share_url`. Per Meta's Comment reference: `attachment_share_url` is exclusive of the other two, but `attachment_id` and `attachment_url` **may** be sent together — do not implement an "exactly one" rule.

### 4.3 Type gating — the GIF trap

An animated GIF comes back as `"type": "animated_image_video"`, `"media_type": "video"`, with an `.mp4` `media_source`. **`media.image.src` for such an attachment is only a still preview frame, not the asset.** Sending it to Gemini produces confident nonsense about a frozen frame.

```ts
function isStillImage(a: { type?: string; media_type?: string; media?: { image?: { src?: string } } }) {
  const mt = String(a.media_type ?? "").toLowerCase();
  const t  = String(a.type ?? "").toLowerCase();
  if (mt !== "photo" && mt !== "image") return false;   // coarse discriminator
  if (t.includes("video") || t.includes("animated")) return false; // fine discriminator
  return Boolean(a.media?.image?.src);
}
```
Both discriminators are required: `media_type` is coarse ("photo, video, link etc"), `type` is fine-grained. **Anything unrecognised is a skip, never an assumed image.** How a *sticker* comment is represented is unknown from every source consulted — the skip-by-default rule is what covers it.

If `attachment` fails the gate but `subattachments.data[]` contains an entry that passes, use the **first** passing subattachment. Whether the Facebook composer even permits multiple photos on one comment could not be confirmed; handle the array defensively and use at most one image regardless.

### 4.4 Downloading — the URL expires

fbcdn `scontent` URLs carry an `oh=` signature and an `oe=` **hex Unix expiry** (decoded real samples: `593B77BB` → 2017-06-10, `6A5ABFEF` → 2026-07-17). Consequences, all mandatory:

- **Download the bytes inside the same webhook-processing pass.** No queueing the URL for later.
- **Never persist the URL.** Not in `MetaEvent`, not in the new table, not in logs.
- Optional cheap pre-check: parse `oe=` as hex and skip if already past. If the parse fails, just attempt the fetch — the mechanism is proven by decoding real URLs, not by a doc statement, so a parse failure means "unknown," not "expired."
- Reuse `fetchImagePart()` in `lib/shoeVision.ts` unchanged: 15s timeout, mime allowlist `^image\/(jpeg|png|webp)$`, reject empty, reject `> 6 MB` raw (≈8 MB base64, comfortably under the 20 MB total-request ceiling that counts text + system instructions + inline bytes together). Every rejection returns `null`, which routes to the no-photo reply.

Do **not** widen the mime allowlist to `heic/heif` on the strength of Gemini's accepted-type list; Meta's CDN does not serve them and a wider allowlist just enlarges the failure surface.

### 4.5 Identification

Ungrounded multimodal `geminiJson()`. **`search` must be `false`/absent — B2.** Image part first, then text.

```ts
export type PhotoRead = {
  name: string | null;          // "Air Jordan 4 Retro Bred" — null when not confident
  colorway: string | null;
  confidence: "high" | "medium" | "low";
  details: string[];            // ["heel tab is yellowed", "midsole paint is clean"]
  isSneaker: boolean;           // false for a dog, a receipt, a meme screenshot
};

export async function readCommentPhoto(
  part: GeminiPart
): Promise<PhotoRead | null>;
```

System prompt requirements:
- Return JSON only.
- `name` must be the common model **plus** colorway when known. **If unsure, `name` must be `null` and `confidence` `"low"`. Never guess.** State explicitly: "a confident wrong name is worse than no name."
- `details` is 1–3 short concrete observations that are true of *this photo* — colour blocking, wear, laces, sole condition, how it's shot. This is what makes the reply able to compliment specifically even when the pair is unnamed, and it is the single highest-value field in the schema.
- `isSneaker: false` when the photo is not footwear at all.
- No prices, no release dates, no production stories, ever.

**Name confirmation without grounding.** When `confidence` is `high` or `medium` and `name` is set, optionally confirm against the site's own catalog:
1. `matchDonorShoe()` / the `CatalogShoe` table — KicksDB-backed, already local, zero external calls, zero policy exposure. **This is the primary path.**
2. `lookupSneaker(name)` **only after** it gains an opt-out. Add `lookupSneaker(query, opts?: { allowGrounded?: boolean })`; default `allowGrounded: true` to preserve existing admin behaviour, and the comment path passes `{ allowGrounded: false }`, which drops `fromGemini` from the waterfall chain. **This is not optional** — without it, `lib/sneakerApi.ts:246` routes a commenter's photo into a grounded call whose result is written to the catalog, which is the exact prohibited pattern in B2.
3. If neither confirms, **downgrade `confidence` to `"low"` and null the name.** Unconfirmed is unnamed.

For genuinely brand-new or obscure pairs the honest answer is: **this bot cannot name them, and must say nothing rather than guess.** Cloud Vision Web Detection is the documented route if the owner wants that capability — no display obligations, no caching restrictions, $3.50/1,000 after 1,000 free/month — but it is a **new Service Provider** requiring its own written agreement under B1 and belongs in a later phase, not this one.

### 4.6 Failure paths — every one degrades to a friendly reply

| Failure | Detection | Behaviour |
|---|---|---|
| No attachment | `attachment` absent or `null` | Normal text reply. `situationBlock` gets `photo: null`. Zero cost. |
| Comment has no text **and** no attachment | both empty | **Skip entirely.** No reply. Nothing to react to. |
| Video or GIF | `isStillImage()` false | Reply to the *text* only. `photo: null`. Never mention "your video." Never analyse a preview frame. |
| Attachment read 400s | Graph error | Log verbatim, retry once with the minimal field list, then `photo: null`. Never let this cost the reply. |
| URL unreachable / expired / 403 | `fetchImagePart` returns `null` | `photo: { attempted: true, identified: null, details: [] }` → the "attached a photo, could not identify" branch. |
| Oversized (> 6 MB) | `fetchImagePart` returns `null` | Same as above. Identical from the reply's point of view. |
| Wrong mime | allowlist reject | Same as above. |
| Gemini down / null | `readCommentPhoto` returns `null` | Same as above. |
| `isSneaker: false` | model says so | `photo: null`, and add a hint to the situation block: "they attached a photo that is not shoes." Let the model banter about the post instead. |
| Model unsure (`confidence: low`) | schema | `photo: { attempted: true, identified: null, details: [...] }` — **details still flow through.** The reply compliments the visible detail without a name. |
| `platformDataAllowed() === false` | env gate | Photo path is dark end to end. Text-only reply, exactly today's behaviour. |
| Rate limit ≥ 80% | usage tracker | Skip the attachment read. Text-only reply. |

**Nothing in this table produces silence caused by the photo, and nothing produces an error posted to Facebook.** The worst outcome is a warm reply that does not mention the photo.

### 4.7 Two required unblockings in existing code

1. `maybePublicAiReply` currently returns early on `if (!e.text || e.text.trim().length < 2) return;` — **a photo-only comment has no text and would never be answered.** Change the guard to `if ((!e.text || e.text.trim().length < 2) && !hasPhoto) return;`.
2. `recordPollVote` returns early on `!e.text` — a photo-only comment is never banked, so it does not count toward the thread tally. Pass `e.text ?? ""` and let `parseVoteChoice("")` return `{label: null, shoe: null}`, which it already does. `condenseThread`'s sample builder already filters empty strings.

---

## 5. THE REPLY

Composition is unchanged in shape: `situationBlock()` builds the brief, `geminiChat()` writes one turn at `temperature: 0.8`, `extractGif()` pulls the `[gif:tag]` marker, `humanize()` strips em dashes, `SKIP` suppresses, output is sliced to 280 chars and POSTed to `/{comment-id}/comments`.

### Changes to `situationBlock`

The `photo` parameter widens:

```ts
photo: {
  attempted: boolean;
  identified: string | null;   // full name + colorway, or null
  colorway: string | null;
  details: string[];           // concrete observations, used even when unnamed
} | null;
```

Emitted lines:
- **Identified:** `They attached a PHOTO of their own shoes. We identified the pair as: {identified}. Details we can see: {details.join(", ")}. Use that name, compliment ONE specific thing from those details, then ask ONE open-ended question about their collection.`
- **Attempted, not identified:** `They attached a PHOTO of their own shoes and we could NOT identify the pair. Do NOT guess at a name and do NOT describe it as any model. What we can honestly see: {details.join(", ")}. Compliment one of those things, then ask ONE open-ended question about their collection.`
- **`sensitive` post:** overrides everything above. Do not mention the photo. Do not ask a question.

Add the `sensitive` branch to the `switch`:
`SITUATION: this post is serious or sombre.{topic} Be brief, warm and sincere. Do not joke, do not use a GIF, do not ask a question, do not mention shoes, picks, votes, the site or the giveaway. If you cannot add something genuine and quiet, answer with exactly the single word SKIP.`

### What makes the question good

The existing `DEFAULT_COMMENT_STYLE` already carries most of this. Tighten it to these rules, which are the actual specification for the photo case:

1. **One question. Not two.** Two questions read as an interrogation and get answered zero times.
2. **Never yes/no.** "Are those clean?" dies. "How long you had those?" doesn't.
3. **About *them*, not about the shoe.** The shoe is the doorway. The question is about ownership, history, rotation, regret, hunting.
4. **Answerable in one line by someone on a phone.** No "walk me through your grail journey."
5. **Anchored to something visible.** A question that follows from the detail you just complimented reads like you looked. A generic question reads like a form.
6. **Rotate the angle.** The style prompt already lists angles; enforce it by feeding the model our last three replies under this post (§3) and telling it not to reuse them.

Question bank, drawn on rather than recited: how long they've had them / how they got them / crown jewel or just today's rotation / what else is in the lineup / the pair they're still hunting / would they ever let someone customise them / the one they'd never sell / on-foot or on-display / did they have the original run or the retro / what they wear them with.

### Example replies, in the Page's voice

Dry, funny, casual. No em dashes, no semicolons. Contractions always. Never opens with Ah, Oh, Wow, Absolutely, Great question, or Love this.

**photo-prompt, identified, good condition**
> Bred 4s and the midsole is still white. That's discipline. How long you had those?

**photo-prompt, identified, visibly worn**
> Panda Dunks creased to hell and back, which is honestly the correct way to own them. Daily driver or did they earn that?

**photo-prompt, not identified, detail visible**
> Can't place those but that gum sole against the off white is doing a lot of work. What are they and where'd you find them?

**photo-prompt, not identified, low light**
> Whatever those are, the photo is not doing them justice lol. Give me the name, I'll go look them up properly.

**photo-prompt, "least favourite" prompt**
> Bold of you to admit you own those. What made you buy them in the first place?

**poll, single vote, tally known**
> The 4s, same as most of the thread so far. You riding with them because of the colorway or because it's the 4?

**poll, multi-vote**
> Nah you can't take all three lol, that's cheating and you know it. If you could only keep one, which one?

**shoe-talk**
> That's the good version of that colorway, the retro got the shape wrong. You have a pair or just admiring?

**off-topic (birthday post)**
> Happy birthday to the page, genuinely. What's the plan, cake or a restock?

**sensitive**
> Sorry to hear that. Thinking of you.

**non-sneaker photo attached**
> That's a great dog and a terrible answer to the question lol. Now show me the shoes.

Where it fits naturally, and never on `off-topic` or `sensitive`, the reply may mention the random apparel giveaway, free to enter by making an account at theheatchart.com — site name in plain words, zero links (the existing rule), never naming specific giveaway items or brands.

---

## 6. WHAT MUST NOT HAPPEN

**Truthfulness**
- Never name a shoe the model was not confident about. `confidence: "low"` or an unconfirmed name means **no name in the reply**, full stop. A confident wrong name is the worst possible output of this feature.
- Never state a release date, retail price, resale value, SKU, collab story, or production run unless it came from the catalog. The model is never the source of a fact about a shoe.
- Never describe an image the bot did not successfully read. No "those look clean" about a photo that 403'd.
- Never analyse a video or a GIF preview frame and speak about it as if it were a photo.

**People**
- Never insult a person. Playful disagreement is allowed **about the shoe only**, one line, never mean.
- Never argue. Never discuss politics, religion, or anything sensitive.
- Never joke under a `sensitive` post. Never attach a GIF to one.
- Never tag or @-mention a commenter (B5). Plain unlinked text only.
- Anyone asking for a human gets a human. `wantsHuman()` already short-circuits everything; keep it first.

**Frequency**
- One public AI reply per comment, ever. `MetaEvent.objectId` is unique and `storeEvents` returns only genuinely-new events; a redelivered webhook must never produce a second reply.
- One public AI reply per commenter per 24h. One private reply per comment, ever (Meta-enforced; error **10900** "Activity already replied to" is terminal, including when a human replied by hand first, and **10903** "This user can't reply to this activity" is terminal too). **Never retry either code** — retrying is precisely the repetitive automated behaviour the Spam standard penalises. Check `can_reply_privately` before attempting, when available, as an optimisation, not a guarantee.
- Respect `PUBLIC_REPLY_HOURLY_CAP` (30) and `SHARE_THANKS_HOURLY_CAP` (12). These are floors. Raising them requires a documented Meta limit in hand, which does not exist (B6).
- Never retry on error 32. Hard stop (§3).

**Platform**
- All outbound remains **reactive**. Nothing in this feature may initiate contact.
- `HUMAN_AGENT` stays unreachable from every automated path.
- Never call the Instagram attachment path. It does not exist (B3).
- Never send `is_hidden` to Instagram or `hide` to Facebook. The existing `hideComment` platform branch exists because the wrong spelling **succeeds silently and does nothing** — moderation that reports success and moderates nothing.
- No scraping, no browser automation, no unofficial endpoints against any Meta surface.

**Data**
- Never send Meta-sourced content to Gemini while `platformDataAllowed()` is false (B1).
- Never set `search: true` on any call whose output reaches Facebook or is persisted (B2). Add a lint-grade check.
- Never persist a comment image's bytes or its CDN URL.
- Never build a per-person record of what shoes someone owns (B4).
- Delete derived descriptions on the retention schedule in §7 — the "we only keep the AI's description, not the image" workaround **does not work**, because derived data is Platform Data by definition.

---

## 7. DATA MODEL

### New: `CommentPhotoRead`

Ephemeral, purge-backed, deliberately thin. It exists for two reasons only: dedup (did we already read this comment's photo) and admin visibility (why did the bot say that). It is **not** a knowledge base.

```prisma
/// One read of a photo a visitor attached to a Facebook comment.
///
/// Everything here is Platform Data — Meta's terms define it to include
/// "data anonymized, aggregated, or derived from such data", so the
/// model's description is governed exactly like the image bytes would
/// be. Hence: no image, no CDN URL (they are signed and expire anyway),
/// a short TTL, and a nightly purge. Facebook only; Instagram comments
/// cannot carry an attachment at all.
model CommentPhotoRead {
  id        String @id @default(cuid())
  /// Meta's comment id. Unique: one read per comment, ever.
  commentId String @unique
  postId    String

  /// photo | video | gif | other | unreadable — what the attachment was.
  /// Anything not "photo" never reached the model.
  mediaKind String

  /// The pair, when we were confident AND the catalog confirmed it.
  /// Null is the normal, honest outcome and must stay cheap.
  identifiedName String?
  colorway       String?
  /// high | medium | low
  confidence     String?
  /// 1-3 short observations used to compliment specifically.
  details        String[] @default([])

  /// Set when a CatalogShoe matched, so the site's own record is the
  /// source of truth for anything factual.
  catalogShoeId String?

  /// Did this read actually produce a public reply.
  replied   Boolean  @default(false)
  createdAt DateTime @default(now())
  /// Hard delete boundary. Nothing here survives it.
  expiresAt DateTime

  @@index([postId])
  @@index([expiresAt])
}
```

**Retention: 7 days.** `expiresAt = now + 7d`, set at insert. Justification: dedup is already carried by `MetaEvent.objectId` (unique) and by `commentId` here; seven days is the admin-visibility window ("why did the bot say that") and nothing needs it longer. Meta requires deletion "as soon as reasonably possible… when retaining the Platform Data is no longer necessary for a legitimate business purpose." Seven days is defensible; thirty is not, for this.

Explicitly **absent** from this model: image bytes, image URL, `fromId`, `fromName`. Omitting the commenter identity is the structural guarantee against B4 — there is no key to aggregate on.

### New: `PlatformDataDeletion`

A Data Deletion Request Callback (or a URL with explicit deletion instructions) is **required** for App Review and for Live mode, must be HTTPS, and must return JSON containing a status-check URL and an alphanumeric confirmation code. This is a product obligation, not a backend TTL: users need "an easily accessible and clearly marked way to ask for their Platform Data to be modified or deleted."

```prisma
/// A user (or Meta, on their behalf) asked us to delete what we hold.
/// The confirmation code is what Meta's callback contract returns and
/// what the status page looks up.
model PlatformDataDeletion {
  id       String @id @default(cuid())
  /// Meta's user id from the signed_request, or a self-serve email.
  subject  String
  platform String   // facebook | instagram
  code     String   @unique @default(cuid())
  status   String   @default("PENDING") // PENDING | DONE | NOT_FOUND
  /// What was actually removed, for the audit trail.
  removed  Json     @default("{}")
  requestedAt DateTime @default(now())
  completedAt DateTime?

  @@index([status, requestedAt])
}
```

Route: `app/api/meta/data-deletion/route.ts`, POST, parses Meta's `signed_request` (same HMAC-SHA256 app-secret discipline as `verifyWebhookSignature`), creates the row, and returns `{ url: "https://theheatchart.com/privacy/deletion?code=<code>", confirmation_code: "<code>" }`. Deletion must cascade into `CommentPhotoRead`, `MetaEvent`, `SocialVote`, `ChatContact` + `ChatMessage` — extend `lib/purgeCascade.ts`. Add the URL to the App Dashboard "Data Deletion Request URL" field.

### Changed: `SocialVote`

No schema change. Two notes that belong in the model's doc comment:
- It stores `fromId`, `fromName`, `rawText` — Platform Data with retention and deletion duties. It is currently unbounded. It must be reachable by the deletion cascade above. Consider a retention sweep in a later pass; **do not** silently start deleting vote history in this pass without the owner's decision, since the claim-token join is the whole point of the table.
- `rawText` is `String` non-null; photo-only comments now write `""`. Do not change the column.

### Models deliberately **not** built

- **No `CommenterProfile` / `UserSneakerCollection` / anything keyed on `fromId` accumulating shoes.** Prohibited absent valid User consent (B4).
- **No `PostBrief` table.** In-memory cache only (§2), for retention reasons.
- **No image blob storage.** `UploadBlob` exists for first-party uploads; a Meta comment photo must never enter it.

---

## 8. IMPLEMENTATION ORDER

Each step leaves the system shipping. Run `npm run verify:meta && npm run verify:chatbot && npm run verify:purge && npm run build` before every commit that touches `lib/` or `app/` (CLAUDE.md), and add the listed checks **in the same pass**, not later.

**1. Compliance gates (no user-visible change).**
Add `platformDataAllowed()` to `lib/gemini.ts` and gate `describePost`, the thread-brief prompt, and every future photo call on it. Add `allowGrounded` to `lookupSneaker()`; the comment paths pass `false`.
*Verify (`verify:chatbot`):* `platformDataAllowed()` is false with the env unset; a source grep asserts no file under `lib/` reachable from `runChatbot` passes `search: true`; `lookupSneaker(q, {allowGrounded:false})` never includes `fromGemini` in its chain.

**2. Rate-limit instrumentation and circuit breaker.**
`graph()` reads `X-Page-Usage` / `X-App-Usage` / `X-Business-Use-Case-Usage`; module-level usage state; 80% skip-optional-reads; 95% stop-writes; error 32 → one-hour hard stop.
*Verify (`verify:meta`):* a stubbed 32 response sets `throttledUntil` and the **next** call throws without a fetch; usage at 85 suppresses optional reads but not replies; usage at 96 suppresses replies; the breaker clears after the window.

**3. Webhook parser hardening.**
`parseWebhookPayload` survives a feed comment value with `post` absent, with unknown extra keys, with `photo` present, and with `photo` absent. Surface `value.photo` on `ParsedEvent` as `photoHint?: string | null` (a hint, never a fetch target).
*Verify (`verify:meta`):* four fixtures — the 2024 real capture, the same minus `post`, the same plus three invented keys, and the 2017 with-photo fixture — all parse to exactly one comment event and never throw.

**4. `sensitive` post kind.**
Extend `PostKind`, `VISION_SYSTEM`, the `switch` in `situationBlock`, and the deterministic regex backstop. Add `expectsPhotos`.
*Verify (`verify:chatbot`):* `situationBlock({brief:{kind:"sensitive"...}})` contains "sincere" and does **not** contain "giveaway", "vote", "pick", or "gif"; an unrecognised kind on a sombre caption resolves to `sensitive`, and on any other caption to `shoe-talk`, never `poll`.

**5. Thread snapshot read.**
`fetchThreadSnapshot()` in `lib/metaEngage.ts` with the §3 field string, the minimal-field degrade, the 10-minute cache, and the IG early return.
*Verify (`verify:meta`):* an IG platform returns `null` **without** a fetch; a 400 on the full field list triggers exactly one retry with the minimal list and sets `partial`; a second call inside the TTL issues zero fetches; a `null` result is cached for 2 minutes.

**6. `condenseThread` rewrite.**
New input shape, dedupe, tally-from-banked-only, reactions line with all eleven counted types, "do not reuse these openings" line.
*Verify (`verify:chatbot`):* a fetched comment with no banked row raises the "N other people" count but **not** any option tally; a `FIRE` count appears in the reactions line (this is the regression guard against a hardcoded six-reaction map); our own comments never appear in the sample; fewer than two other voices still returns `null`; the "except" comment is always excluded.

**7. Comment attachment read.**
`fetchCommentAttachment(platform, commentId)` in `lib/metaEngage.ts`: FB-only, singular `attachment`, `isStillImage()` gate, `subattachments` fallback, minimal-field degrade.
*Verify (`verify:meta`):* Instagram returns `null` with zero fetches; an `animated_image_video`/`video` payload returns `null` **even though `media.image.src` is present** (the GIF trap); an unknown `type` returns `null`; a `photo`/`image` with `src` returns the URL; a payload where only a subattachment passes returns that one; the request string contains `attachment{` and **not** `attachments{`.

**8. Photo identification.**
`readCommentPhoto()` in `lib/shoeVision.ts` (ungrounded, image-part-first), catalog confirmation, unconfirmed → name nulled and confidence downgraded.
*Verify (`verify:chatbot`):* a `low` confidence response yields `identified === null` but preserves `details`; a `high` confidence name with no catalog match is downgraded to `null`; `isSneaker:false` yields `photo: null` plus the non-shoe hint; the request body has no `tools` key.

**9. Wiring into the reply.**
Widen the `situationBlock` `photo` param; relax the `!e.text` guards in `maybePublicAiReply` and `recordPollVote`; pass the real photo object; insert `CommentPhotoRead`.
*Verify (`verify:chatbot`):* a photo-only comment (no text) now reaches the reply path; `situationBlock` with an identified photo contains the name and "ONE open-ended question"; with `attempted:true, identified:null` it contains "do NOT guess" and never contains a model name; a source-grep asserts `photo: null` is no longer hardcoded at the `maybePublicAiReply` call site.

**10. Retention and deletion.**
`CommentPhotoRead` + `PlatformDataDeletion` migrations, nightly purge of `expiresAt < now`, `app/api/meta/data-deletion/route.ts`, cascade extension, public deletion-instructions page, App Dashboard field.
*Verify (`verify:purge`):* a `CommentPhotoRead` past `expiresAt` is deleted and one inside it is not; the deletion cascade removes `CommentPhotoRead`, `MetaEvent`, `SocialVote`, `ChatContact`/`ChatMessage` for a subject; the callback rejects an unsigned request and returns both `url` and `confirmation_code` for a signed one; a source-grep asserts no field named like an image URL or blob exists on `CommentPhotoRead`.

**Cross-cutting verify additions (any step):** a check that `lib/` contains no request to `attachments{` on a comment id; a check that no IG code path references `attachment`, `is_hidden`, `message` (IG uses `text`), `created_time` (IG uses `timestamp`), `filter`, `order`, or `since`; a check that `order=ranked` appears nowhere.

---

## 9. UNVERIFIED AND RISKY

**Zero Meta primary documentation was readable during this research.** `developers.facebook.com`, `graph.facebook.com`, `transparency.meta.com`, `facebook.com/legal`, `ai.google.dev`, `firebase.google.com`, `web.archive.org` and `stackoverflow.com` all returned 403 at the egress proxy. Everything below marked "unverified" is unverified *because of that*, not because it was skipped. The `meta_developer_tools` MCP server would likely answer several of these authoritatively and **should be authorised before the next research pass**.

### Probe before trusting

1. **The assembled comment-attachment request path (§4.2).** Every field name is verified from generated SDK source; the assembled query string is construction. **Probe:** issue it against a real comment with a photo. Expect a possible 400; narrow field by field. The `subattachments{data{...}}` nesting is the most likely offender.
2. **`filter=stream` vs `filter=toplevel` semantics.** Both spellings verified in three SDKs; **what they return is unverified** — specifically whether `stream` flattens replies and `toplevel` suppresses them. **Probe:** one post with a known reply structure, both values, compare.
3. **Maximum `limit` on the comments edge.** No documented ceiling. Do not hardcode 100 or 500. **Probe:** request a large limit and observe whether Meta silently caps or errors.
4. **Deep-pagination behaviour.** No documented cap and no documentation that none exists. The spec avoids paging entirely; if that ever changes, bound it in code first.
5. **Whether field expansion bills as one call or several against the Page budget.** The existence of `total_cputime` and `total_time` as separate throttled dimensions suggests an expanded query costs more even when `call_count` increments once. **Probe:** issue one expanded request and one equivalent set of flat requests, read the `X-Page-Usage` / `X-App-Usage` delta for each.
6. **The exact membership of the comments `summary` object.** `total_count` is confirmed and confirmed **approximate**; search snippets also mentioned `order` and `can_comment` inside it, unconfirmed.
7. **Whether the feed webhook still emits `photo`.** Evidence is genuinely split: two 2017 restfb fixtures (the field landed in restfb 1.37.0, Feb 2017, not 1.45 as often cited), still modelled on restfb master with no `@Deprecated`; a 2026-07-30 third-party Zod schema omits it — but that schema **strips unknown keys by default and its consumer explicitly discards comment events**, so it is an argument from silence over a lossy source and carries no weight; and a separate 2026 production codebase actively reads `value.photo` on `field: 'feed'`. Spec treats it as opportunistic-only, which is correct either way. Also note the wider family: `photos` (array of URLs) on `item: "status"`, `photo_id` on `item: "photo"`, `photo_ids` on album adds.
8. **Whether `value.post` is contractual.** Observed Sept 2023 and June 2024, modelled as required by a third-party schema in Nov 2025, undocumented in any Meta source, ignored entirely by at least one production parser, and never verified against a current API version. **Null-guard it. Do not "clean up" the guard later.**
9. **Whether a full-resolution variant of a comment photo is available** versus only the scaled `media.image.src`. Reading `attachment{target{id}}` then `GET /{photo-id}?fields=images` is a plausible route but is inference, untested, and its permission requirements are unknown.
10. **Whether one Facebook comment can carry multiple photos** at the composer level. `subattachments` exists and is the right place to look; the product behaviour is unconfirmed.
11. **How a sticker comment is represented.** No attachment `type` value for stickers was found in any source. The skip-unrecognised-by-default rule covers it; do not add a sticker branch on a guess.
12. **`can_reply_privately` and `private_reply_conversation`.** Both field names confirmed in three official SDKs and in Meta's own codegen spec, **Facebook only** — they do not exist on the IG Comment node. But their *semantics* are undocumented (`private_reply_conversation` is typed only as `Object`), and the claim that reading `can_reply_privately` prevents error 10903 is inference, not documentation. Treat as a deliverability optimisation, never as a ban control, and keep the 10900/10903 terminal handling regardless.
13. **The private-reply time window.** Sources conflict: Instagram Platform docs say 7 days; an older Graph API page says "several months". Platform-specific and unresolved. The current `sendPrivateReply` doc comment says nothing about a window — it should, once this is settled. The error code returned specifically on window expiry is unknown; **instrument and log the raw error envelope** on first production occurrence rather than assuming it maps to 10900.
14. **Error codes 10900 and 10903** come from a vendor help centre (Agorapulse), corroborated only by unreadable Meta forum thread titles. Not from Meta's error reference.
15. **`facepile_mentioned_ids`.** Exists in generated SDK source as `list<string>`. Semantics, permission, and whether it accepts personal-profile IDs are entirely undocumented. **Do not use it.**
16. **Whether a Page comment reply can carry a GIF at all.** `attachment_share_url` exists on the comment-creation edge and the repo already sends it, but no documentation confirms GIF support on *replies posted by a Page* specifically, and nothing confirms `attachment_share_url` is the GIPHY/Tenor parameter — that attribution is an untested hypothesis. Do not put it in a code comment as fact.
17. **The exact permission text** for `pages_read_user_content` and `pages_read_engagement`. Paraphrase only. No evidence was found of any *additional* permission specific to comment attachments — absence of evidence, not evidence of absence.
18. **Graph API version.** The repo pins **v23.0** in `lib/metaEngage.ts` (10 occurrences across `lib/` and `app/`, plus one stale **v21.0** reference worth reconciling). The dossier's own checkers disagree with each other on what is current: some say v25.0 (2026-02-18), one says v26.0 shipped 2026-07-29. Both are secondary reports; the changelog itself was unreachable. **Do not bump the version on this dossier's authority.** Verify against the live changelog first. Under Meta's two-year guarantee v23.0 (~May 2025) should hold to ~May 2027.
19. **Webhook mTLS.** Meta reportedly moved webhook certificates to its own CA on **2026-03-31**, requiring `meta-outbound-api-ca-2025-12.pem` in the trust store or deliveries fail the TLS handshake. That date has passed. Secondary sources only. **Check the webhook receiver's trust store independently of this feature** — if this is real and unhandled, the entire webhook pipeline is at risk and nothing in this spec matters.
20. **`metadata=1` introspection** was reportedly removed across all versions on 2026-05-19. Grep the repo; secondary-sourced.
21. **Gemini model lifecycle.** `gemini-2.0-flash` was hard-shut-down 2026-06-01 and has already been removed from the ladder in `lib/gemini.ts` — good. `gemini-2.5-flash`, the current backstop, is *reportedly* scheduled for shutdown **2026-10-16**; secondary sources only, `ai.google.dev/gemini-api/docs/deprecations` was 403. The two flash-lite ids at the top of the ladder (`gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`) were never callable from this environment; the SDK enum lists `gemini-3.1-flash-lite` and `gemini-flash-lite-latest` but **not** `gemini-3.5-flash-lite`. **Probe:** a live `ListModels` call, then pin `GEMINI_MODEL` rather than relying on the ladder.
22. **Which Gemini terms actually govern this app.** The quoted grounding use-restrictions come from `cloud.google.com/terms/service-terms` (Google Cloud / Agent Platform). This app calls `generativelanguage.googleapis.com` with an API key, governed by the Developer API terms at `ai.google.dev/gemini-api/terms`, which was 403. Expectation is that they are equivalent or stricter, and the display requirement is independently confirmed for the Developer API — but the ownership and caching wording was not read firsthand. Does not change the recommendation (the display requirement alone already fails in a comment), but the owner should read it.
23. **Whether enabling Cloud Billing genuinely reclassifies free-of-charge usage as a Paid Service** for data-use purposes. This is the load-bearing fact behind the B1 remediation and it is `[unverified]` — search paraphrase only. **Read it directly before flipping `META_SERVICE_PROVIDER_ATTESTED`.**
24. **Verbatim Platform Terms retention text.** Section 3(d)(i) is referenced by effect, not quoted. The archived Platform Terms used throughout are verbatim and internally consistent but carry **no snapshot date**, and the GitHub commits API was blocked for that repo. Do not quote them in a compliance document without re-reading the live page.
25. **Whether Meta requires AI-labelling of Page *text* replies.** No such rule was found; Meta's shipped labelling targets photorealistic image/video. This is "no rule found", **not** "no rule exists" — `transparency.meta.com` was unreachable. Disclose anyway.
26. **A poisoned reference file to avoid.** `tactful-ai/channels-integrations/Instagram/docs/InstagramComments.md` is named "InstagramComments" but contains a **Facebook** payload (`"object": "page"`, `"field": "feed"`). Anyone using it as an IG reference will import a Facebook shape into Instagram code — the exact bug class CLAUDE.md says has already cost this codebase once. Do not let it near the IG path.
# Implementation spec — tappable URL button on Messenger replies

Target: `/home/user/designer-kicks-platform/lib/metaEngage.ts` (`sendDmReply`, lines 484–530; `graph()` lines 235–259), `/home/user/designer-kicks-platform/scripts/verify-meta.ts`.

**Sourcing note (CLAUDE.md rule):** `developers.facebook.com` was hard-blocked (403 on CONNECT) for the research pass. Every claim below is documentary — Meta's own published Postman collections and sample apps on GitHub, plus verbatim doc scrapes. No live API call was made against the Page. Items that could not be confirmed are listed in §7 and are **not** load-bearing anywhere in §2–§5.

---

## 1. VERDICT

**Safe and shippable now. No blocker. Nothing to configure before deploy.**

- **Domain whitelisting is NOT required.** `whitelisted_domains` (Messenger Profile API) applies only when `messenger_extensions: true`, i.e. the Messenger Extensions SDK. A plain `web_url` button needs no allowlisting anywhere. Meta, verbatim: *"To display a webpage with the Messenger Extensions SDK enabled in the Messenger webview you **must** whitelist the domain…"* — the requirement is scoped to the SDK, which we are not using. Since we will never emit `messenger_extensions`, there is nothing to register for `theheatchart.com`.
- **Policy is clear.** The URL button is explicitly sanctioned inside the button template (*"Supported Usage: … Button template"*), and promotional content is permitted inside the standard window (*"Messages sent within the 24-hour window may contain promotional content."*). Reactive-only posture, `messaging_type=RESPONSE`, and the existing caps are all unchanged.
- **Instagram divergence — pre-empted, not deferred.** There is no IG send path in `lib/` today, but the sender must be built IG-safe from day one: emit the **three-key button only** (`type`, `url`, `title`). `webview_height_ratio` is documented as *not available* on Instagram, and IG's button property table lists only `type`/`url`/`title`/`payload`. Omitting both optional keys is the only shape provably correct on both surfaces — and it is also the shape in Meta's own recorded 200-OK responses on both `graph.facebook.com` and `graph.instagram.com`. §5 has the branch list for when an IG sender lands.

**Three things that bite the current code** (all handled in §2–§3):
1. `message.text` and `message.attachment` are **mutually exclusive** (*"`text` and `attachment` are mutually exclusive"*). The copy must **move into** `payload.text` — you cannot add `attachment` beside the existing `{ text }`.
2. `payload.text` is capped far below plain text. `lib/chatbot.ts:417` slices AI replies to **1900** chars — legal for plain text (`< 2000`, exclusive), ~3× over the template ceiling. Any long reply routed through the button path must degrade, not fail.
3. Button `title` is capped at **20 chars**, same rule the code already enforces for quick-reply titles. `"Open The Heat Chart"` = 19, fits.

---

## 2. THE EXACT MESSAGE OBJECT

The literal value of the `message` form field, JSON-stringified exactly as `graph()` already does for `quick_replies`:

```json
{
  "attachment": {
    "type": "template",
    "payload": {
      "template_type": "button",
      "text": "Fresh drops land on the site first.",
      "buttons": [
        {
          "type": "web_url",
          "url": "https://theheatchart.com",
          "title": "Open The Heat Chart"
        }
      ]
    }
  }
}
```

Every key above is confirmed verbatim against Meta-authored sources. **No `webview_height_ratio`. No `messenger_extensions`. No `fallback_url`** (that key may only be set when `messenger_extensions` is true, so it is irrelevant here). Posted with the unchanged siblings `recipient={"id":PSID}` and `messaging_type=RESPONSE`. Success response is `{"recipient_id": "...", "message_id": "..."}`.

Cardinality: `buttons` is *"Set of 1-3 buttons"* — never empty, never four. We send exactly one.

**What happens to the existing quick_replies path:** it survives, unchanged, as a **sibling of `attachment`** — not a casualty of it. Meta's Send API states *"Quick Replies work with all message types including text message, image and template attachments,"* and the current Quick Replies doc shows one `message` object carrying both arrays. So the combined object is:

```json
{
  "attachment": { "type": "template", "payload": { "template_type": "button", "text": "…", "buttons": [ … ] } },
  "quick_replies": [ { "content_type": "text", "title": "…", "payload": "…" } ]
}
```

Existing caps stay exactly as coded: `.slice(0, 13)` replies, `.slice(0, 20)` titles, `payload` ≤ 1000 chars. **Caveat:** Meta's only published `quick_replies` + `attachment` example pairs it with a **generic** template; I found no Meta example pairing it with a **button** template specifically (§7). This is de-risked structurally: if Meta refuses that exact pair, the degrade path in §4 immediately re-sends the identical copy and quick replies as plain text, so the worst case is a lost button, never a lost message. Smoke-test the pair before assuming it renders.

---

## 3. THE TYPESCRIPT

### 3a. Extract the builder (this is what makes §6 possible)

Verify suites are the contract, and the mutual-exclusion rule is the thing most likely to be reintroduced by a future edit. Make it **structurally impossible** by building the message in one exported pure function, then assert on that function without a token.

Add above `sendDmReply` in `lib/metaEngage.ts`:

```ts
/** A tappable link on an outbound reply. Three keys, deliberately: Meta
 *  documents webview_height_ratio as unavailable on Instagram, and
 *  messenger_extensions is only for the Extensions SDK (which would drag
 *  in domain whitelisting). Neither is ever emitted, so one shape is
 *  correct on both surfaces. */
export type ReplyButton = { title: string; url: string };

/** Meta's Button Template reference caps payload.text at 640 UTF-8 chars.
 *  An archived copy of the same page said 320 — if a send is ever refused
 *  on length, that older value is the first suspect. One constant, so
 *  that is a one-line change and not a hunt. */
const TEMPLATE_TEXT_MAX = 640;
/** Button title, 20-char limit — the same rule quick-reply titles already
 *  follow two lines below. */
const BUTTON_TITLE_MAX = 20;
/** Self-imposed: the Page's replies link to our own site or nowhere. A
 *  flow row edited in the admin can't turn outbound DMs into a link farm.
 *  Not a Meta limit; no character limit on `url` is documented anywhere. */
const BUTTON_HOST = /(^|\.)theheatchart\.com$/i;

function urlButton(b: ReplyButton): { type: "web_url"; url: string; title: string } | null {
  let u: URL;
  try {
    u = new URL(b.url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !BUTTON_HOST.test(u.hostname)) return null;
  const title = b.title.trim().slice(0, BUTTON_TITLE_MAX);
  if (!title) return null;
  return { type: "web_url", url: u.toString(), title };
}

/**
 * The one place a DM's `message` field is shaped.
 *
 * `text` and `attachment` are mutually exclusive on the Send API, so this
 * returns one or the other — a ternary, not two conditional assignments,
 * which is what makes "both were set" unrepresentable rather than merely
 * untested. Copy longer than the template's ceiling degrades to a plain
 * text send: the reply is the product, the button is a bonus.
 */
export function buildDmMessage(
  text: string,
  quickReplies?: Array<{ label: string; payload: string }>,
  button?: ReplyButton
): Record<string, unknown> {
  const btn = button ? urlButton(button) : null;
  const message: Record<string, unknown> =
    btn && text.length <= TEMPLATE_TEXT_MAX
      ? {
          attachment: {
            type: "template",
            payload: { template_type: "button", text, buttons: [btn] },
          },
        }
      : { text };
  if (quickReplies && quickReplies.length > 0) {
    message.quick_replies = quickReplies.slice(0, 13).map((q) => ({
      content_type: "text",
      title: q.label.slice(0, 20),
      payload: q.payload,
    }));
  }
  return message;
}
```

Truncation/limit enforcement all lives here, in one function: **title → 20** (`urlButton`), **buttons → exactly 1**, in-range of the documented 1–3 (`buttons: [btn]`), **text → degrade at 640** (the ternary), **quick replies → 13 / 20** (unchanged, moved verbatim). Note the text limit **degrades rather than truncates** — silently cutting a customer's answer mid-sentence to make room for a marketing button is the wrong trade.

### 3b. Tag Graph refusals so the degrade can't double-send

In `graph()` (line ~255), replace the bare `Error` so a refusal Meta actually returned is distinguishable from a timeout that may have delivered:

```ts
/** An error Meta returned. A fetch abort or DNS failure is NOT this —
 *  the message may have landed, so those must never trigger a retry. */
export class GraphError extends Error {}
```
```ts
if (!res.ok || json.error) throw new GraphError(json.error?.message || `Graph ${res.status}`);
```

`GraphError extends Error`, so every existing `catch` and every caller that reads `.message` is unaffected.

### 3c. `sendDmReply`

Signature: **append a 5th optional parameter.** All four existing call sites (`app/actions.ts:6667`, `:6718`, `lib/chatbot.ts:266`, `:368`, `:418`, `lib/metaEngage.ts:622`) keep compiling untouched, including the two that pass `undefined, "human_agent"` positionally.

```ts
export async function sendDmReply(
  recipientId: string,
  text: string,
  quickReplies?: Array<{ label: string; payload: string }>,
  sender: ReplySender = "automation",
  button?: ReplyButton
): Promise<void> {
  // The link button is marketing; a desk reply carrying the human-agent
  // tag is support, and Meta lists automated and unrelated content as
  // disallowed usage of that tag. So the button is unreachable from the
  // desk path by construction, not by the caller remembering.
  const linked = sender === "automation" ? button : undefined;
  const withButton = buildDmMessage(text, quickReplies, linked);
  const plain = buildDmMessage(text, quickReplies);
  const attached = "attachment" in withButton;
  const body = (m: Record<string, unknown>) => ({
    recipient: JSON.stringify({ id: recipientId }),
    message: JSON.stringify(m),
  });

  if (sender !== "human_agent") {
    try {
      await graph("me/messages", { ...body(withButton), messaging_type: "RESPONSE" }, "POST");
    } catch (err) {
      // A button must never cost us the message. On any refusal Meta
      // returned for a send that carried an attachment, resend the same
      // copy and the same quick replies as plain text. No error-string
      // allowlist — guessing Meta's prose from memory broke the desk once
      // already. A timeout or network failure rethrows untouched: that
      // send may have been delivered, and a retry would double-message.
      if (!attached || !(err instanceof GraphError)) throw;
      await graph("me/messages", { ...body(plain), messaging_type: "RESPONSE" }, "POST");
    }
    return;
  }

  // ---- unchanged below: the human_agent path always sends `plain` ----
  try {
    await graph(
      "me/messages",
      { ...body(plain), messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" },
      "POST"
    );
  } catch {
    await graph("me/messages", { ...body(plain), messaging_type: "RESPONSE" }, "POST");
  }
}
```

Two existing verify checks constrain this edit — do not trip them:
- `(engageSrc.match(/"HUMAN_AGENT"/g) ?? []).length === 1` — the new code must branch on `sender === "automation"`, never on a second `"HUMAN_AGENT"` literal.
- `!/catch\s*\{[\s\S]{0,200}catch/.test(tagBlock)` — `tagBlock` is sliced from the `messaging_type: "MESSAGE_TAG"` index forward, and the new `try/catch` sits **above** it (the automation path returns early), so it is outside the slice. Keep it that way.

`messaging_type` is unchanged everywhere: it describes the message **type**, not the content type (*"`RESPONSE` – Message is in response to a received message"*), and templates carry no RESPONSE-specific restriction.

### 3d. Call sites

The change is inert until a caller opts in. First caller should be **one deliberate flow** at `lib/chatbot.ts:266` (`sendDmReply(contact.psid, flow.message, buttons, "automation", { title: "Open The Heat Chart", url: "https://theheatchart.com" })`), with copy authored under 640 chars.

**Do not pass a button from `lib/chatbot.ts:418`** (the Gemini path) while its slice is 1900 — every send would silently take the degrade branch and never render a button. If that path should carry the link, drop its slice to `TEMPLATE_TEXT_MAX` first and accept the shorter answers.

**`sendPrivateReply` stays unchanged.** A button is technically permitted there, but the private reply does not open the 24-hour window — only the person's answer does — so that message has to earn a reply, not hand over a link. Judgment call, not a doc limitation.

---

## 4. FAILURE PATHS

| Failure | Behavior |
|---|---|
| Meta refuses the templated send (`GraphError`) — malformed template, unsupported `quick_replies`+button pair, an undiscovered length rule | **Degrade to plain text and resend immediately.** Same copy, same quick replies, same `messaging_type=RESPONSE`. The customer gets the answer; only the button is lost. |
| Templated send times out / network error (`AbortSignal.timeout(20000)`, DNS, TLS) | **Rethrow, no retry.** The message may already have been delivered; a retry would double-message the customer. This is the one place where "never lose the message" loses to "never send it twice." |
| Degrade attempt itself fails | Its error propagates unguarded — the error from the send that actually mattered is what the desk sees. Same principle the HUMAN_AGENT fallback already follows. |
| No button was requested | `attached === false`, so the `catch` rethrows on the first line. Behavior for all six existing call sites is **byte-identical to today**: one send, error propagates. |
| A bad URL reaches the sender (http://, off-domain, unparseable) or an empty title | `urlButton()` returns `null`, `buildDmMessage` emits `{ text }`. The reply sends clean; no throw, no half-built attachment. |
| `sender === "human_agent"` and a button is passed anyway | Button dropped before the message is built. The desk path is never templated and never retries differently than today. |

Deliberately **not** done: no error-string allowlist, no matching on Meta's refusal prose, no parsing of error subcodes. The `GraphError` class carries the only distinction that matters (Meta answered vs. we never heard back), which is a fact about the transport rather than a guess about wording.

---

## 5. INSTAGRAM

There is no IG send path in `lib/` today — `graph()` is pinned to `FB_API` with the Page token. When one lands, the shared sender branches on exactly these, and nothing else:

1. **Host and token.** `graph.instagram.com/v{n}/{ig_user_id}/messages` with the IG token, vs. the Facebook path. This is the only transport difference; Meta's own IG collection has a recorded **200 OK** for a `web_url` button template on that host.
2. **Button shape: no branch needed — that is the point.** `{type, url, title}` is byte-identical on both surfaces. Never emit `webview_height_ratio` (Meta states it *"is not available"* on IG) or `messenger_extensions` (not in IG's property table at all). Because `buildDmMessage` cannot emit them, the IG branch inherits correctness for free.
3. **Button `type` enum.** IG accepts only `postback` and `web_url` — no `phone_number`, no `account_link`/`account_unlink`. We only ever emit `web_url`, so this constrains future work, not this change.
4. **Text length — the real branch.** Meta documents Messenger plain text as *"less than 2000 characters"* (exclusive), while IG's messaging docs state *"1000 bytes or less"* — a **different number in a different unit**. A 4-byte emoji burns four. Any IG-facing length guard must use `Buffer.byteLength(text, "utf8")`, not `.length`. The IG button template's own `payload.text` ceiling is **unverified** (§7) — do not assume 640 there.
5. **`messaging_type=RESPONSE` is correct on IG too** — Meta's IG collection sends it against the IG messages endpoint.
6. **Nothing to whitelist on IG either.** IG opens the link in the *"in-app browser"* rather than the Messenger webview — a UX wording difference only, no configuration.

Caution signal, not a prohibition: Meta's official IG sample app ships `genQuickReply`, `genImage`, `genText`, `genPostbackButton`, `genGenericTemplate` — but **no** `genButtonTemplate` and **no** web_url button helper, unlike the Facebook version of the same sample. Given the recorded IG 200 OK, this reads as sample coverage lag, but it argues for smoke-testing the IG path explicitly rather than inferring it from the Messenger path.

---

## 6. VERIFY CHECKS (`scripts/verify-meta.ts`)

All pure — no token, no network — using the exported `buildDmMessage` plus the file's existing source-scan idiom. Add a `// ---- Outbound button template ----` section. `npm run verify:meta`, `verify:chatbot`, `verify:purge` and `npm run build` all run before commit.

```ts
const BTN = { title: "Open The Heat Chart", url: "https://theheatchart.com" };
const m = buildDmMessage("Fresh drops land on the site first.", undefined, BTN) as any;

// --- wire shape (§2) ---
check("a button reply is a button template",
  m.attachment?.type === "template" && m.attachment?.payload?.template_type === "button",
  "attachment.type=template, payload.template_type=button — the two keys Meta names");
check("the copy moves into payload.text, and top-level text is gone",
  !("text" in m) && m.attachment.payload.text === "Fresh drops land on the site first.",
  "message.text and message.attachment are mutually exclusive; sending both is malformed");
check("the button carries exactly the three documented keys",
  JSON.stringify(Object.keys(m.attachment.payload.buttons[0]).sort()) === '["title","type","url"]',
  "webview_height_ratio is not available on Instagram; messenger_extensions would drag in domain whitelisting");
check("the button is a web_url button", m.attachment.payload.buttons[0].type === "web_url");
check("exactly one button, never an empty array",
  m.attachment.payload.buttons.length === 1, "Meta documents a set of 1-3");

// --- limits (§1, §3a) ---
const longTitle = buildDmMessage("hi", undefined, { ...BTN, title: "x".repeat(40) }) as any;
check("a long button title is sliced to 20, same as quick-reply titles",
  longTitle.attachment.payload.buttons[0].title.length === 20);
const long = buildDmMessage("x".repeat(641), undefined, BTN) as any;
check("copy over the template ceiling degrades to plain text, not a truncated answer",
  long.text?.length === 641 && !("attachment" in long),
  "chatbot.ts slices AI replies to 1900 — legal as text, 3x over the template limit");
check("copy at the ceiling still gets its button",
  "attachment" in (buildDmMessage("x".repeat(640), undefined, BTN) as any));

// --- text/attachment exclusivity, exhaustively ---
for (const [name, msg] of [["plain", buildDmMessage("hi")],
                           ["button", buildDmMessage("hi", undefined, BTN)],
                           ["both args", buildDmMessage("x".repeat(700), [{label:"a",payload:"b"}], BTN)]] as const) {
  check(`${name}: exactly one of text|attachment is set`,
    ("text" in (msg as any)) !== ("attachment" in (msg as any)));
}

// --- quick replies survive (§2) ---
const qr = buildDmMessage("hi", Array.from({length: 20}, (_, i) => ({ label: "label-that-is-far-too-long", payload: `p${i}` })), BTN) as any;
check("quick replies ride alongside the attachment, not instead of it",
  Array.isArray(qr.quick_replies) && "attachment" in qr,
  "Meta: quick replies work with template attachments");
check("quick replies keep their own caps under the button template",
  qr.quick_replies.length === 13 && qr.quick_replies.every((q: any) => q.title.length === 20 && q.content_type === "text"));

// --- URL guard (§3a) ---
for (const bad of ["http://theheatchart.com", "https://evil.com", "https://theheatchart.com.evil.com", "not a url"])
  check(`a button to ${bad} degrades to plain text`,
    !("attachment" in (buildDmMessage("hi", undefined, { title: "Go", url: bad }) as any)),
    "the Page's replies link to our own site over https, or nowhere");
check("a subdomain of our own site is allowed",
  "attachment" in (buildDmMessage("hi", undefined, { title: "Go", url: "https://shop.theheatchart.com/x?utm=dm" }) as any));

// --- serialization (the field is JSON-stringified into a form body) ---
check("the message survives the form encoding with no undefined keys",
  JSON.stringify(JSON.parse(JSON.stringify(m))) === JSON.stringify(m));

// --- policy boundaries, source-scanned (engageSrc is already read above) ---
check("the sender never emits the IG-hostile optional button keys",
  !/webview_height_ratio|messenger_extensions|fallback_url/.test(engageSrc),
  "the three-key button is the only shape provably correct on Messenger and Instagram");
check("the link button is unreachable from the human-agent path",
  /const linked = sender === "automation" \? button : undefined/.test(engageSrc),
  "Meta lists automated and unrelated content as disallowed usage of that tag");
check("the human-agent path sends the plain message, never a template",
  !/body\(withButton\)[\s\S]{0,400}MESSAGE_TAG/.test(engageSrc));
check("a template refusal degrades to plain text rather than losing the reply",
  /if \(!attached \|\| !\(err instanceof GraphError\)\) throw;[\s\S]{0,300}body\(plain\)/.test(engageSrc),
  "a button must never cost us the message");
check("a timeout is not retried",
  /instanceof GraphError/.test(engageSrc),
  "a send that may have been delivered must never be resent");
check("and no error-string allowlist gates the degrade",
  !/message\.(includes|match)|test\(err/.test(engageSrc),
  "guessing Meta's refusal prose from memory broke the desk once already");
check("one message builder, so the exclusivity rule can't be reintroduced",
  (engageSrc.match(/template_type/g) ?? []).length === 1);
```

The last check is the durable one: if a future edit hand-rolls a second template payload somewhere else in the file, the suite fails before the malformed send reaches the Page.

**Not covered by any of the above, and it must be a manual step:** send one real templated reply to a staff account inside an open window, on both the quick-replies-present and quick-replies-absent variants, before the flow goes live to customers.

---

## 7. UNVERIFIED — probe against the live API or live docs before trusting

Every item here is either flagged in code (a named constant, a degrade branch) or scoped out of this change. Nothing in §2–§5 depends on an unverified number being correct.

1. **The 640-character `payload.text` ceiling.** Present verbatim in two doc-page scrapes (*"UTF-8-encoded text of up to 640 characters"*), but **absent** from Meta's own Postman collection — a targeted search of the 402 KB file returned zero hits. Worse, an **archived** copy of the same reference page says **320**. Mitigated by `TEMPLATE_TEXT_MAX` being a single named constant and by degrading rather than failing. **Probe:** send 400 and 630 characters of `payload.text` to a staff account. If 400 is refused, the live value is 320.
2. **`me/messages` as the documented send target.** All seven button-template samples in Meta's collection POST to `{page-id}/messages`; the only `me/messages` occurrences in the whole file are GET examples on the Conversation API. `me/messages` is the legacy Page-token alias and is used at three call sites in `metaEngage.ts` today and working — but it is **not** the doc-sanctioned form. Out of scope for this change; worth a separate migration to `${FB_PAGE_ID}/messages`.
3. **`quick_replies` + *button* template specifically.** Documented as siblings and Meta shows the pair with a **generic** template; no Meta example or statement covers the button-template pairing. The degrade path makes it safe to ship, but the combination is unproven. **Probe:** first smoke-test message.
4. **Any character limit on the button `url`.** Undocumented — not in Meta's collections, not in the reference scrapes, not in any doc-derived SDK typing. The 1000-char limits in the docs belong to quick-reply `payload` and message `metadata`; do not transfer those numbers. The code deliberately does **not** truncate `url`. **Probe only if** long tracking params ever appear.
5. **Instagram's button-template `payload.text` limit.** IG has its own doc page with its own rules; the FB 640 does not govern it, and IG's plain-text rule is stated in **bytes** (1000), a different unit. The IG 1000-byte figure itself was corroborated across searches but never read first-hand.
6. **Whether IG rejects or silently ignores `webview_height_ratio`/`messenger_extensions` on a button.** Untested — and moot, since we never emit them. This is exactly why we never emit them.
7. **Graph API version.** The code pins `v23.0` via `GRAPH_API_URL`. Doc snapshots rendered `v25.0`; **v26.0 released 2026-07-29** (two days ago) — inferred from release cadence plus demonstrated dynamic version substitution in the doc examples, **not** read live. The button template shape is stable across all of these and versions stay callable ~2 years, so `v23.0` is fine today. Pin deliberately; do not copy whatever a doc example renders.
8. **Graph's behavior on an out-of-range `buttons` array** (0 or 4+). Documented as 1–3 and enforced in third-party validation code, but the error response is unconfirmed. We always send exactly 1.
9. **Generic template element count** (future richer-card work). Meta's own current doc contradicts itself: the payload table says *"A maximum of 1 element is supported"*, the section below says *"a maximum of 10 elements per message."* Assume 1 until tested.
10. **No live API call was made during research** — no token was in scope, and test traffic on the owner's Page was not worth the risk. Every shape above is documentary, including one recorded 200-OK response captured by Meta in its own collection.

**Two policy obligations that adding this button does not change, but that stay live:** the automated-experience disclosure requirement (disclose at the start of a thread, after a significant lapse, or when a chat moves from human to automated), and the 30-second responsiveness rule. A `web_url` tap is a navigation, not a `messaging_postbacks` event, so it creates no new input to answer — but a **postback** button would, and that obligation attaches the moment one is added. Meta's own best practice for URL buttons applies to the copy: *"Make it clear you're sending people outside of Messenger"* — hence `"Open The Heat Chart"` over `"Tap here"`.
/**
 * The Meta integration layer, checked at the seams.
 *
 * Nothing here talks to Meta. What breaks integrations like this in
 * practice is never the happy-path POST — it's the seams: a webhook
 * accepted without checking its signature, a rules engine that answers
 * its own replies forever, a caption that blows the 500-char Threads
 * cap, an OAuth callback that trusts whatever state it's handed. Those
 * are all pure logic, so they're all testable without a token.
 *
 * Run: npm run verify:meta   (dev database; every row it makes it deletes)
 */
import { createHmac } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { mmeLink, parseRef, refFor } from "../lib/mme";
import { scheduleParams, stripUrls } from "../lib/social";
import { menuItems } from "../lib/chatbot";
import {
  buildDmMessage,
  parseWebhookPayload,
  ruleMatches,
  storeEvents,
  verifyWebhookSignature,
} from "../lib/metaEngage";
import { authorizeUrl, connectRedirectUri, isConnectProvider } from "../lib/metaConnect";
import { appsecretProof, businessSecret, proofParams } from "../lib/appsecret";
import { businessAppSecret } from "../lib/metaConnect";
import { ownChannelCaption } from "../lib/crosspost";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const TAG = "vmeta";
const SECRET = "test-app-secret";

/** Every .ts/.tsx under a directory, so the scan can't miss a file. */
function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

async function main() {
  process.env.FB_PAGE_ID = "111000111";
  process.env.IG_USER_ID = "222000222";
  process.env.INSTAGRAM_APP_ID = "ig-app";
  process.env.THREADS_APP_ID = "th-app";
  process.env.FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID || "fb-app";

  // ---- Webhook signatures --------------------------------------------
  const body = JSON.stringify({ object: "page", entry: [] });
  check("a correctly signed payload verifies", verifyWebhookSignature(body, sign(body), SECRET));
  check("a tampered payload is refused", !verifyWebhookSignature(body + " ", sign(body), SECRET));
  check("a missing header is refused", !verifyWebhookSignature(body, null, SECRET));
  check(
    "an empty app secret refuses everything",
    !verifyWebhookSignature(body, sign(body), ""),
    "fail closed: no secret must never mean no check"
  );
  check(
    "a malformed header is refused, not crashed on",
    !verifyWebhookSignature(body, "sha256=zzzz", SECRET)
  );

  // ---- Payload parsing ------------------------------------------------
  const commentPayload = {
    object: "page",
    entry: [
      {
        changes: [
          {
            field: "feed",
            value: {
              item: "comment",
              comment_id: `${TAG}-c1`,
              post_id: `${TAG}-p1`,
              from: { id: "999", name: "A Fan" },
              message: "What's the price on these?",
            },
          },
          {
            field: "feed",
            value: {
              item: "comment",
              comment_id: `${TAG}-c2`,
              from: { id: "111000111", name: "The Page" },
              message: "Our own reply echoing back",
            },
          },
          { field: "feed", value: { item: "like", post_id: `${TAG}-p1` } },
        ],
      },
    ],
  };
  const parsed = parseWebhookPayload(commentPayload);
  check("a visitor comment is captured", parsed.some((e) => e.objectId === `${TAG}-c1`));
  check(
    "our own reply is filtered out",
    !parsed.some((e) => e.objectId === `${TAG}-c2`),
    "without this the rules engine answers itself in a loop"
  );
  check("a like is not an event", parsed.length === 1, `${parsed.length} captured`);

  const dmPayload = {
    object: "page",
    entry: [
      {
        messaging: [
          { sender: { id: "888" }, message: { mid: `${TAG}-m1`, text: "yo is the vest still up" } },
          { sender: { id: "111000111" }, message: { mid: `${TAG}-m2`, text: "our outbound", is_echo: true } },
        ],
      },
    ],
  };
  const dms = parseWebhookPayload(dmPayload);
  check("an inbound DM is captured", dms.some((e) => e.objectId === `${TAG}-m1`));
  check("our own outbound echo is not", !dms.some((e) => e.objectId === `${TAG}-m2`));

  const igPayload = {
    object: "instagram",
    entry: [
      {
        changes: [
          {
            field: "comments",
            value: { id: `${TAG}-ig1`, from: { id: "777", username: "sneakfan" }, text: "🔥🔥" },
          },
        ],
      },
    ],
  };
  const ig = parseWebhookPayload(igPayload);
  check("an IG comment is captured with its platform", ig[0]?.platform === "instagram");

  // ---- Storage dedup --------------------------------------------------
  const stored1 = await storeEvents(parsed);
  const stored2 = await storeEvents(parsed);
  check("events store once", stored1.length === 1, `${stored1.length}`);
  check(
    "a redelivered webhook stores nothing",
    stored2.length === 0,
    "Meta redelivers; the chat bot only routes what storeEvents says is fresh"
  );

  // ---- Rules ----------------------------------------------------------
  check(
    "a keyword rule matches its comment, case-insensitively",
    ruleMatches({ kind: "comment_keyword", trigger: "PRICE" }, { kind: "comment", text: "what's the price?" })
  );
  check(
    "and not an unrelated comment",
    !ruleMatches({ kind: "comment_keyword", trigger: "price" }, { kind: "comment", text: "clean work" })
  );
  check(
    "a keyword rule never touches DMs",
    !ruleMatches({ kind: "comment_keyword", trigger: "price" }, { kind: "message", text: "price?" })
  );
  check(
    "a welcome rule fires on messages only",
    ruleMatches({ kind: "dm_welcome", trigger: null }, { kind: "message", text: "hi" }) &&
      !ruleMatches({ kind: "dm_welcome", trigger: null }, { kind: "comment", text: "hi" })
  );
  check(
    "an unknown rule kind matches nothing",
    !ruleMatches({ kind: "cold_outreach", trigger: "x" }, { kind: "message", text: "x" }),
    "the shape of the engine is the policy: only replies exist"
  );

  // ---- OAuth plumbing -------------------------------------------------
  check("provider whitelist holds", isConnectProvider("instagram") && !isConnectProvider("tiktok"));
  const igUrl = new URL(authorizeUrl("instagram", "nonce123"));
  check("IG authorize goes to instagram.com", igUrl.hostname.endsWith("instagram.com"));
  check(
    "IG asks for the Instagram-Login scope family",
    igUrl.searchParams.get("scope") === "instagram_business_basic,instagram_business_content_publish",
    "the FB-login flavor's scope names would silently fail here"
  );
  check("state rides the IG url", igUrl.searchParams.get("state") === "nonce123");
  const thUrl = new URL(authorizeUrl("threads", "n"));
  check("Threads authorize goes to threads.net", thUrl.hostname.endsWith("threads.net"));
  const fbUrl = new URL(authorizeUrl("facebook_page", "n"));
  check(
    "Facebook asks for Pages scopes — profiles aren't a thing any app can post to",
    (fbUrl.searchParams.get("scope") ?? "").includes("pages_manage_posts")
  );
  check(
    "callback paths are per-provider",
    connectRedirectUri("threads").endsWith("/api/social/callback/threads")
  );

  // ---- appsecret_proof ------------------------------------------------
  // Meta's spec: HMAC-SHA256 of the ACCESS TOKEN, keyed by the APP
  // SECRET, hex-encoded. Getting the operand order backwards produces a
  // plausible-looking hash that Meta rejects on every call, so the
  // known-answer test is the point.
  const KNOWN = createHmac("sha256", "the-app-secret").update("the-token").digest("hex");
  check(
    "proof is HMAC(token) keyed by secret, hex",
    appsecretProof("the-token", "the-app-secret") === KNOWN,
    "reversing the operands is the classic way to get this wrong"
  );
  check(
    "the same pair always yields the same proof",
    appsecretProof("t", "s") === appsecretProof("t", "s")
  );
  check(
    "a different secret yields a different proof",
    appsecretProof("t", "s1") !== appsecretProof("t", "s2"),
    "each app signs only its own tokens"
  );
  check(
    "a different token yields a different proof",
    appsecretProof("t1", "s") !== appsecretProof("t2", "s")
  );
  check("proof is 64 hex chars", /^[0-9a-f]{64}$/.test(appsecretProof("t", "s") ?? ""));

  // Degrading rather than throwing is what lets the code ship BEFORE
  // the dashboard toggle flips.
  check("no secret means no proof, not a crash", appsecretProof("t", "") === null);
  check("no token means no proof", appsecretProof("", "s") === null);
  check("params are empty when unconfigured", Object.keys(proofParams("t", undefined)).length === 0);
  check(
    "params carry the proof when configured",
    proofParams("t", "s").appsecret_proof === appsecretProof("t", "s"),
    ""
  );
  check(
    "the proof never leaks the secret itself",
    !JSON.stringify(proofParams("t", "super-secret")).includes("super-secret")
  );

  // ---- Which secret, and did anyone forget to sign ---------------------
  // The HMAC checks above prove the primitive works on literal strings.
  // They cannot catch the two failures that actually happen: resolving
  // the WRONG app's secret, and a call site that never asks for a proof
  // at all. Both shipped once. Hence these.
  const savedBiz = process.env.META_BUSINESS_APP_SECRET;
  const savedFb = process.env.FACEBOOK_CLIENT_SECRET;

  process.env.META_BUSINESS_APP_SECRET = "business-secret";
  process.env.FACEBOOK_CLIENT_SECRET = "login-app-secret";
  check(
    "the business secret wins over the login app's",
    businessSecret() === "business-secret",
    "signing a Page token with the consumer login app's key is a code-190 on every call"
  );
  check(
    "inbound verification and outbound signing resolve identically",
    businessAppSecret() === businessSecret(),
    "these were two copies once; if they drift, webhooks 401 while publishing still works"
  );

  delete process.env.META_BUSINESS_APP_SECRET;
  check(
    "the login app's secret is NOT borrowed when the business one is missing",
    businessSecret() === "",
    "wrong-app signing reads as code 190 and retires connected accounts as EXPIRED"
  );
  delete process.env.FACEBOOK_CLIENT_SECRET;
  check("no secret configured resolves to empty, not undefined", businessSecret() === "");

  if (savedBiz === undefined) delete process.env.META_BUSINESS_APP_SECRET;
  else process.env.META_BUSINESS_APP_SECRET = savedBiz;
  if (savedFb === undefined) delete process.env.FACEBOOK_CLIENT_SECRET;
  else process.env.FACEBOOK_CLIENT_SECRET = savedFb;

  // Hand-built token URLs are how a call escapes signing: the params
  // never pass through proofParams, so nothing flags it. The only
  // legitimate ones are OAuth's exchange legs, which already carry
  // client_secret in the URL — strictly stronger than a proof.
  const TOKEN_URL = /access_token=\$\{/;
  const offenders: string[] = [];
  for (const dir of ["lib", "app"]) {
    for (const file of walk(join(process.cwd(), dir))) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      const src = readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        if (!TOKEN_URL.test(line)) return;
        // Look at the surrounding statement, not just the line — these
        // are prettier-wrapped across several lines.
        const stmt = src.split("\n").slice(Math.max(0, i - 6), i + 3).join("\n");
        if (!stmt.includes("client_secret")) {
          offenders.push(`${file.replace(/.*designer-kicks-platform\//, "")}:${i + 1}`);
        }
      });
    }
  }
  check(
    "no Graph call hand-builds a token URL that skips the proof",
    offenders.length === 0,
    offenders.length ? offenders.join(", ") : "OAuth exchange legs carry client_secret, so they're exempt"
  );

  for (const f of ["social", "metaEngage", "metaPublish", "metaConnect", "threads", "chatbot"]) {
    const src = readFileSync(join(process.cwd(), "lib", `${f}.ts`), "utf8");
    check(
      `lib/${f}.ts is wired to the signing helper`,
      src.includes('from "./appsecret"'),
      "a token-bearing module that can't reach proofParams cannot sign"
    );
  }

  // ---- The human-agent line -------------------------------------------
  // HUMAN_AGENT tells Meta a person is answering. The bot must never be
  // able to say that. This is a policy boundary with the Page's
  // messaging access on the other side of it, so it gets a test rather
  // than a comment asking nicely.
  const HUMAN_TAG = /"human_agent"|HUMAN_AGENT/;
  const AUTOMATION_FILES = ["lib/chatbot.ts", "lib/gemini.ts"];
  for (const f of AUTOMATION_FILES) {
    let src = "";
    try {
      src = readFileSync(join(process.cwd(), f), "utf8");
    } catch {
      continue; // file may not exist in every checkout
    }
    check(
      `${f} cannot reach the human-agent tag`,
      !HUMAN_TAG.test(src),
      "an automated reply claiming to be a human agent is a misrepresentation to Meta"
    );
  }

  const engageSrc = readFileSync(join(process.cwd(), "lib", "metaEngage.ts"), "utf8");
  const actionsSrc = readFileSync(join(process.cwd(), "app", "actions.ts"), "utf8");
  check(
    "the tag rides on MESSAGE_TAG, never on RESPONSE",
    /messaging_type:\s*"MESSAGE_TAG",\s*tag:\s*"HUMAN_AGENT"/.test(engageSrc) &&
      (engageSrc.match(/"HUMAN_AGENT"/g) ?? []).length === 1,
    "Meta refuses a tag sent with messaging_type RESPONSE"
  );
  const tagBlock = engageSrc.slice(
    engageSrc.indexOf('messaging_type: "MESSAGE_TAG"'),
    engageSrc.indexOf("/* ---", engageSrc.indexOf('messaging_type: "MESSAGE_TAG"'))
  );
  check(
    "ANY refused tag falls back to a plain reply",
    /catch\s*\{[\s\S]{0,400}messaging_type:\s*"RESPONSE"/.test(tagBlock),
    "the feature isn't approved yet; the fallback carries 100% of desk replies today"
  );
  check(
    "and no error-string allowlist gates that fallback",
    !/test\(msg\)/.test(tagBlock),
    "guessing Meta's refusal prose from memory broke the desk once already"
  );
  check(
    "a failed fallback still surfaces ITS error",
    !/catch\s*\{[\s\S]{0,200}catch/.test(tagBlock),
    "the RESPONSE attempt is unguarded, so a closed window or dead token throws honestly"
  );

  // Hiding a comment names its parameter differently per platform, and
  // the wrong one fails silently while the desk records HIDDEN.
  check(
    "hiding a comment branches on platform",
    /platform === "instagram" \? \{ hide:/.test(engageSrc),
    "Instagram takes hide=<bool>; is_hidden is Facebook-only and IG ignores it"
  );
  check(
    "the hide caller passes the platform through",
    /hideComment\(event\.platform,/.test(actionsSrc),
    "defaulting to Facebook's spelling leaves IG comments live"
  );
  check(
    "automation is the default sender, so a forgotten argument fails safe",
    /sender:\s*ReplySender\s*=\s*"automation"/.test(engageSrc),
    "defaulting the other way would tag every bot reply as human"
  );

  const humanCalls = actionsSrc.match(/"human_agent"/g) ?? [];
  check(
    "only the admin desk sends as a human, and both its paths do",
    humanCalls.length === 2,
    `${humanCalls.length} call sites — expected the two behind requireAdmin()`
  );

  // ---- Links ride the first comment, never the caption -----------------
  // A Facebook post with an outbound link in its text is a link post,
  // and link posts reach fewer people. The whole point of the link is
  // the click, so the post publishes clean and the link lands as our
  // own first comment. House rule across BOTH publish paths.
  const socialSrc = readFileSync(join(process.cwd(), "lib", "social.ts"), "utf8");
  const mpSrc = readFileSync(join(process.cwd(), "lib", "metaPublish.ts"), "utf8");
  check(
    "the house caption never carries the link",
    !/caption: opts\.link/.test(socialSrc),
    "appending the link to the photo caption was the old shape"
  );
  check(
    "the PHOTO post never passes Facebook's link parameter",
    (() => {
      const fn = socialSrc.slice(socialSrc.indexOf("export async function postToFacebookPage"));
      return !/link:/.test(fn.slice(0, fn.indexOf("\n}\n")));
    })(),
    "the link param on the photo post is what would turn it into a link post and cost it reach"
  );

  // The card post is the deliberate exception, and it is a SEPARATE
  // post with its own function rather than a flag, so the rule above
  // cannot be weakened by accident.
  check(
    "the card post exists and is its own thing",
    /export async function postLinkCardToFacebookPage/.test(socialSrc)
  );
  check(
    "the card's copy is stripped of raw URLs",
    /message: stripUrls\(message\)/.test(socialSrc),
    "the card already IS the link; a URL in the words as well reads as spam twice"
  );
  check(
    "a bare url is removed from card copy",
    stripUrls("Vote now at https://theheatchart.com/battles today") ===
      "Vote now at today"
  );
  check(
    "and so is a www-style one",
    stripUrls("see www.theheatchart.com for more") === "see for more"
  );
  check(
    "copy with no url is left alone",
    stripUrls("Which one are you actually wearing?") === "Which one are you actually wearing?"
  );
  check(
    "the follow-up card is scheduled, not published alongside",
    /scheduledAt: new Date\(Date\.now\(\) \+ hours \* 3_600_000\)/.test(socialSrc),
    "two identical-timed posts about one link is the duplicate-content shape"
  );
  check(
    "a failed first post does not queue a card on top of it",
    /Skipped — the first post didn't publish/.test(socialSrc),
    "queueing on an unknown state just makes it harder to see what happened"
  );
  check(
    "the house link lands as a comment on the new post",
    /commentLinkOnPost/.test(socialSrc) && /\/comments`, \{ message: link \}/.test(socialSrc)
  );
  check(
    "editors' Page posts follow the same rule",
    !/caption: opts\.link/.test(mpSrc) && !/\.\.\.\(opts\.link \? \{ link:/.test(mpSrc)
  );
  check(
    "and their link comments on the post id, not the page",
    /\$\{postId\}\/comments/.test(mpSrc)
  );
  check(
    "a refused link comment doesn't unwind a published post",
    /\/comments[\s\S]{0,200}\.catch\(/.test(mpSrc),
    "the post is up either way; only the comment is best-effort"
  );

  // ---- Caption budget -------------------------------------------------
  const caption = ownChannelCaption({
    title: "A Very Long Title For A Custom Shoe Indeed Yes",
    baseShoe: "Air Force 1 Low '07 White",
  });
  const link = "https://theheatchart.com/artists/some-long-artist-slug?utm_source=artist-channel&utm_medium=autopost&utm_campaign=own-work";
  check(
    "caption + link stays under the Threads 500-char cap",
    caption.length + 2 + link.length <= 500,
    `${caption.length + 2 + link.length} chars`
  );
  check("the caption speaks as the artist, not about them", !caption.includes(" by "));

  // ---- Outbound button template ----------------------------------------
  // Pure: no token, no network. The wire shape is the whole risk here,
  // and it is the kind that fails silently as "Meta just refused it".
  const BTN = { title: "Open The Heat Chart", url: "https://theheatchart.com" };
  type Msg = {
    text?: string;
    attachment?: { type?: string; payload?: { template_type?: string; text?: string; buttons?: Array<Record<string, unknown>> } };
    quick_replies?: unknown[];
  };
  const m = buildDmMessage("Fresh drops land on the site first.", undefined, BTN) as Msg;

  check(
    "a button reply is a button template",
    m.attachment?.type === "template" && m.attachment?.payload?.template_type === "button"
  );
  check(
    "the copy moves INTO payload.text and the top-level text is gone",
    !("text" in m) && m.attachment?.payload?.text === "Fresh drops land on the site first.",
    "message.text and message.attachment are mutually exclusive; sending both is malformed"
  );
  check(
    "the button carries exactly the three keys that work on both surfaces",
    JSON.stringify(Object.keys(m.attachment!.payload!.buttons![0]).sort()) ===
      '["title","type","url"]',
    "webview_height_ratio is unavailable on Instagram and messenger_extensions would drag in domain whitelisting"
  );
  check("it is a web_url button", m.attachment!.payload!.buttons![0].type === "web_url");
  check("exactly one button, never an empty array", m.attachment!.payload!.buttons!.length === 1);

  const longTitle = buildDmMessage("hi", undefined, { ...BTN, title: "x".repeat(40) }) as Msg;
  check(
    "a long button title is sliced to 20, same rule quick-reply titles follow",
    String(longTitle.attachment!.payload!.buttons![0].title).length === 20
  );
  const longCopy = buildDmMessage("x".repeat(641), undefined, BTN) as Msg;
  check(
    "copy over the template ceiling drops the button rather than the sentence",
    longCopy.text?.length === 641 && !("attachment" in longCopy),
    "chatbot.ts slices replies to 1900, which is legal as text and 3x over the template limit"
  );
  check(
    "copy exactly at the ceiling still gets its button",
    "attachment" in (buildDmMessage("x".repeat(640), undefined, BTN) as Msg)
  );

  for (const [name, msg] of [
    ["plain", buildDmMessage("hi")],
    ["with a button", buildDmMessage("hi", undefined, BTN)],
    ["long copy plus a button", buildDmMessage("x".repeat(700), [{ label: "a", payload: "b" }], BTN)],
  ] as const) {
    check(
      `${name}: exactly one of text or attachment is set`,
      ("text" in (msg as Msg)) !== ("attachment" in (msg as Msg))
    );
  }

  check(
    "quick replies survive alongside a button",
    Array.isArray(
      (buildDmMessage("hi", [{ label: "Yes", payload: "Y" }], BTN) as Msg).quick_replies
    )
  );

  // The link can only ever be ours. A flow row edited in the admin must
  // not be able to turn the Page's DMs into a link farm.
  for (const bad of [
    { title: "x", url: "http://theheatchart.com" },
    { title: "x", url: "https://evil.example.com" },
    { title: "x", url: "https://nottheheatchart.com" },
    { title: "x", url: "not a url" },
    { title: "   ", url: "https://theheatchart.com" },
  ]) {
    check(
      `a button for ${bad.url} (${bad.title.trim() || "no title"}) is refused, and the reply still sends`,
      !("attachment" in (buildDmMessage("hi", undefined, bad) as Msg))
    );
  }
  check(
    "a subdomain of our own site is allowed",
    "attachment" in (buildDmMessage("hi", undefined, { title: "Go", url: "https://www.theheatchart.com/x" }) as Msg)
  );

  const botSrcBtn = readFileSync(join(process.cwd(), "lib", "chatbot.ts"), "utf8");
  check(
    "the ticket DM carries a button to claim it",
    /title: "Claim your ticket", url: claimUrl/.test(botSrcBtn),
    "the ticket is the whole point of that message"
  );
  check(
    "and the claim link stays in the words too",
    /🎟️ Your ticket: \$\{claimUrl\}/.test(botSrcBtn),
    "a long ticket degrades to plain text, and a degraded ticket with no link is not a ticket"
  );
  check(
    "campaign flows offer the site",
    /siteButton\(\)\)/.test(botSrcBtn) && /"automation", siteButton\(\)/.test(botSrcBtn)
  );
  check(
    "but the hand-off to a human does not",
    !/real person from The Heat Chart[\s\S]{0,400}siteButton/.test(botSrcBtn),
    "a marketing button under 'a real person will pick this up' reads as badly as it sounds"
  );
  check(
    "a burned private reply is never resent after a timeout",
    /Meta allows exactly ONE/.test(
      readFileSync(join(process.cwd(), "lib", "metaEngage.ts"), "utf8")
    ),
    "one private reply per comment, ever, so a blind resend burns the only shot at that person"
  );

  // ---- The always-on menu ----------------------------------------------
  const botMenuSrcEarly = readFileSync(join(process.cwd(), "lib", "chatbot.ts"), "utf8");
  const menu = menuItems();
  check("the menu offers something to tap", menu.length > 0 && menu.length <= 5);
  check(
    "every menu item is a web_url with only the three portable keys",
    menu.every(
      (i) => JSON.stringify(Object.keys(i).sort()) === '["title","type","url"]' && i.type === "web_url"
    ),
    "messenger_extensions is what would drag in domain whitelisting"
  );
  check("no menu title runs past the cap", menu.every((i) => i.title.length <= 30));
  const siteOrigin = new URL(
    (process.env.NEXT_PUBLIC_SITE_URL || "https://theheatchart.com").replace(/\/$/, "")
  ).origin;
  check(
    "every menu item points at OUR configured site, never somebody else's",
    menu.every((i) => new URL(i.url).origin === siteOrigin)
  );
  check(
    "a non-https site url refuses to install rather than pinning dead links",
    /would install dead links/.test(botMenuSrcEarly),
    "the menu is retroactive, so there is no quiet version of that mistake"
  );
  const botMenuSrc = readFileSync(join(process.cwd(), "lib", "chatbot.ts"), "utf8");
  check(
    "the composer stays enabled",
    /composer_input_disabled: false/.test(botMenuSrc),
    "a private reply does not open the messaging window, only their answer does, so they must be able to type"
  );

  // ---- m.me attribution -------------------------------------------------
  process.env.FB_PAGE_USERNAME = "theheatchart";
  check("a tracked door carries its ref", mmeLink("battle", 42) === "https://m.me/theheatchart?ref=battle_42");
  check(
    "a ref is stripped to a safe alphabet",
    refFor("battle", "42?x=1&y=2") === "battle_42x1y2",
    "the allowed character set is not published anywhere, so be stricter than Meta rather than guess looser"
  );
  check("a ref never runs past Meta's ceiling", refFor("x".repeat(500)).length <= 200);
  check(
    "the ref survives the round trip",
    (() => {
      const r = parseRef("battle_42");
      return r?.kind === "battle" && r.id === "42";
    })()
  );
  check("a kind with no id round-trips too", parseRef("giveaway")?.id === null);
  check("an empty ref is nothing, not a blank link", parseRef("  ") === null);
  const savedUser = process.env.FB_PAGE_USERNAME;
  delete process.env.FB_PAGE_USERNAME;
  const savedPage = process.env.FB_PAGE_ID;
  delete process.env.FB_PAGE_ID;
  check(
    "no page configured means no link at all, never a broken one",
    mmeLink("battle", 1) === null,
    "a dead m.me in a caption is worse than no m.me"
  );
  if (savedUser) process.env.FB_PAGE_USERNAME = savedUser;
  if (savedPage) process.env.FB_PAGE_ID = savedPage;

  // ---- Scheduling -------------------------------------------------------
  check("no date means an ordinary immediate post", scheduleParams(null) === null);
  check(
    "sooner than ten minutes is refused before we send it",
    scheduleParams(new Date(Date.now() + 5 * 60_000)) === null
  );
  check(
    "further out than 75 days is refused too",
    scheduleParams(new Date(Date.now() + 80 * 86_400_000)) === null
  );
  const sched = scheduleParams(new Date(Date.now() + 3600_000));
  check(
    "a valid time sends BOTH params",
    sched?.published === "false" && Boolean(sched?.scheduled_publish_time),
    "a time without published=false just posts it immediately, which is the opposite of scheduling"
  );
  check(
    "the timestamp is unix seconds, not milliseconds",
    Number(sched!.scheduled_publish_time) < 1e11
  );

  const engSrcBtn = readFileSync(join(process.cwd(), "lib", "metaEngage.ts"), "utf8");
  check(
    "a refused button degrades to plain text, and only when Meta actually answered",
    /if \(!attached \|\| !\(e instanceof GraphError\)\) throw e;/.test(engSrcBtn),
    "resending after a timeout would double-message somebody, since we never learned if it landed"
  );
  check(
    "the desk never sends a templated message",
    /sender === "human_agent" \? undefined : button/.test(engSrcBtn),
    "a real person typing gets the strictest send there is"
  );
}

async function cleanup() {
  await prisma.metaEvent.deleteMany({ where: { objectId: { startsWith: TAG } } });
}

main()
  .catch((e) => {
    fail++;
    log.push(`FAIL threw — ${e instanceof Error ? e.message : String(e)}`);
  })
  .then(cleanup)
  .catch(() => {})
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n=== THE META LAYER, CHECKED AT THE SEAMS ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });

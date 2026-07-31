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
import {
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

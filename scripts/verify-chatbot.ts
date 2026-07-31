/**
 * The chat bot's routing brain, tested where it can go wrong.
 *
 * The bot's failure modes are all routing failures: answering the same
 * comment twice, a catch-all stealing a campaign's commenters, the
 * escalation words not reaching a human, a redelivered webhook
 * replaying a conversation. All pure logic — none of it needs Meta.
 *
 * Run: npm run verify:chatbot   (dev database; every row it makes it deletes)
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import {
  DEFAULT_COMMENT_STYLE,
  extractGif,
  humanize,
  keywordHit,
  parseGifLibrary,
  matchCommentFlow,
  matchMessageFlow,
  parseQuickReplies,
  wantsHuman,
  type FlowLite,
} from "../lib/chatbot";
import { parseWebhookPayload } from "../lib/metaEngage";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const log: string[] = [];
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  log.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

function flow(over: Partial<FlowLite>): FlowLite {
  return { id: "f", trigger: "comment", keywords: [], postId: null, active: true, ...over };
}

async function main() {
  // The self-filter reads our ids from env; without these the "is this
  // us?" checks below would pass vacuously against an empty set.
  process.env.FB_PAGE_ID = "111000111";
  process.env.IG_USER_ID = "222000222";

  // ---- Keyword matching ----------------------------------------------
  check("a keyword matches inside a sentence, any case", keywordHit(["heat"], "ok HEAT me please"));
  check("* matches anything", keywordHit(["*"], "whatever"));
  check("* matches even an empty comment", keywordHit(["*"], null), "emoji-only comments have no text");
  check("no keywords match nothing", !keywordHit([], "heat"));
  check("empty text without * matches nothing", !keywordHit(["heat"], null));

  // ---- Comment routing ------------------------------------------------
  const campaign = flow({ id: "campaign", keywords: ["heat"], postId: "post_777" });
  const net = flow({ id: "net", keywords: ["*"] });
  const paused = flow({ id: "paused", keywords: ["heat"], active: false });

  check(
    "a post-pinned flow beats the catch-all on its own post",
    matchCommentFlow([net, campaign], "HEAT", "page_111_post_777")?.id === "campaign",
    "otherwise every campaign drowns in the general net"
  );
  check(
    "on other posts the catch-all takes it",
    matchCommentFlow([net, campaign], "HEAT", "page_111_post_888")?.id === "net"
  );
  check("a paused flow never fires", matchCommentFlow([paused], "heat", null) === null);
  check(
    "a comment matching nothing routes nowhere",
    matchCommentFlow([campaign], "clean work", "page_111_post_777") === null,
    "not every comment deserves a DM — only the ones that asked"
  );

  // ---- DM routing ------------------------------------------------------
  const dmFlow = flow({ id: "dm", trigger: "message", keywords: ["giveaway", "vest"] });
  check("a DM keyword routes", matchMessageFlow([dmFlow], "how do I enter the GIVEAWAY?")?.id === "dm");
  check("a comment flow never catches a DM", matchMessageFlow([campaign], "heat") === null);

  // ---- The human escape hatch -----------------------------------------
  check("asking for a human is always caught", wantsHuman("can I talk to a real person"));
  check("so is STOP", wantsHuman("STOP"));
  check("and unsubscribe", wantsHuman("unsubscribe me"));
  check(
    '"agent" inside another word does not trigger it',
    !wantsHuman("that colorway is magenta"),
    "word boundaries, not substrings"
  );

  // ---- Quick replies ---------------------------------------------------
  const qrs = parseQuickReplies([
    { label: "Drop link", flowId: "f1" },
    { label: "", flowId: "f2" },
    { label: "Broken", flowId: "" },
    "garbage",
  ]);
  check("valid buttons parse to flow payloads", qrs.length === 1 && qrs[0].payload === "flow:f1");
  check("blank labels and dangling targets are dropped", !qrs.some((q) => q.payload === "flow:f2" || q.payload === "flow:"));
  check("junk rows don't crash the parser", parseQuickReplies("not-an-array").length === 0);

  // ---- Webhook shapes the bot depends on -------------------------------
  const tap = parseWebhookPayload({
    object: "page",
    entry: [
      {
        messaging: [
          {
            sender: { id: "555" },
            message: { mid: "m-tap-1", text: "Drop link", quick_reply: { payload: "flow:f1" } },
          },
        ],
      },
    ],
  });
  check("a quick-reply tap carries its payload", tap[0]?.payload === "flow:f1");

  const pb = parseWebhookPayload({
    object: "page",
    entry: [
      { messaging: [{ sender: { id: "555" }, timestamp: 1234, postback: { payload: "GET_STARTED", title: "Get Started" } }] },
    ],
  });
  check("a Get Started postback becomes a routable message", pb[0]?.payload === "GET_STARTED");
  check("postbacks get a stable synthetic id", pb[0]?.objectId === "pb-555-1234", pb[0]?.objectId ?? "none");

  const ref = parseWebhookPayload({
    object: "page",
    entry: [{ messaging: [{ sender: { id: "556" }, timestamp: 9, referral: { ref: "drafted" } }] }],
  });
  check("an m.me ?ref= arrives as ref:…", ref[0]?.payload === "ref:drafted");

  // ---- The machine tells ----------------------------------------------
  // Telling the model "no em dashes" works most of the time. Most of the
  // time, on a page this size, is still several a week in public.
  check(
    "an em dash becomes a comma",
    humanize("These are clean — where'd you get them?") ===
      "These are clean, where'd you get them?",
    humanize("These are clean — where'd you get them?")
  );
  check(
    "an en dash goes too",
    humanize("Nice pair – love the midsole") === "Nice pair, love the midsole"
  );
  check(
    "a tight em dash with no spaces still goes",
    humanize("Clean—very clean") === "Clean, very clean"
  );
  check(
    "semicolons become commas",
    humanize("Solid work; the fade is right") === "Solid work, the fade is right"
  );
  check(
    "no doubled commas survive",
    !humanize("one —, two").includes(",,"),
    humanize("one —, two")
  );
  check(
    "spacing before punctuation is cleaned up",
    humanize("Nice  work — really .") === "Nice work, really."
  );
  check(
    "ordinary text is left alone",
    humanize("Those are clean. Where'd you cop them?") ===
      "Those are clean. Where'd you cop them?"
  );
  check(
    "hyphens in real words are untouched",
    humanize("one-of-one heat") === "one-of-one heat",
    "an em dash is not a hyphen and the difference matters"
  );
  check(
    "the comment style tells the model the same rule the code enforces",
    /em dash/i.test(DEFAULT_COMMENT_STYLE),
    "belt and braces: prompt asks, code guarantees"
  );

  // ---- Post context + reaction GIFs ------------------------------------
  // The Page runs "which shoe: 1, 2 or 3?" posts. A comment that says
  // "2" only means something next to the caption, so the brief has to
  // demand the read, and the gif machinery has to be impossible to
  // leak: no bracket syntax in public, no URL the admin didn't stock.
  check(
    "the brief tells the model to read the post before the comment",
    /READ THE POST FIRST/.test(DEFAULT_COMMENT_STYLE)
  );
  check(
    "and to rotate its question angles rather than loop one",
    /ROTATE YOUR QUESTIONS/.test(DEFAULT_COMMENT_STYLE)
  );
  check(
    "picks get answered by shoe name, not option number",
    /not 'option 2'/.test(DEFAULT_COMMENT_STYLE)
  );

  const lib = parseGifLibrary("fire https://cdn.example/fire.gif\nSHEESH https://cdn.example/sheesh.gif\nbroken-line-no-url\n");
  check("the gif library parses tag-space-url lines", lib.fire === "https://cdn.example/fire.gif");
  check("library tags are case-insensitive on save", lib.sheesh === "https://cdn.example/sheesh.gif");
  check("a line without a URL is dropped, not mangled", Object.keys(lib).length === 2);
  check("an empty library parses to nothing", Object.keys(parseGifLibrary("")).length === 0);

  const stocked = extractGif("Cold pick, the 4s win that row. [gif:fire]", lib);
  check("a stocked tag becomes an attachment", stocked.gifUrl === "https://cdn.example/fire.gif");
  check("and the bracket never reaches the public text", !stocked.text.includes("["), stocked.text);

  const unstocked = extractGif("Respect the choice. [gif:chef-kiss]", lib);
  check("an unstocked tag is stripped, not attached", unstocked.gifUrl === null);
  check("stripped cleanly", unstocked.text === "Respect the choice.");
  check(
    "case and spacing in the tag don't matter",
    extractGif("Nah. [ GIF: Fire ]", lib).gifUrl === "https://cdn.example/fire.gif"
  );
  check(
    "plain text passes through untouched",
    extractGif("Those are clean.", lib).text === "Those are clean."
  );

  const botSrc = readFileSync(join(process.cwd(), "lib", "chatbot.ts"), "utf8");
  check(
    "the gif comes out BEFORE humanize touches the text",
    /extractGif\(reply[\s\S]{0,200}humanize\(bare\)/.test(botSrc),
    "humanize would eat the bracket's spacing and orphan the tag"
  );
  const engSrc = readFileSync(join(process.cwd(), "lib", "metaEngage.ts"), "utf8");
  check(
    "Instagram replies drop the gif instead of failing",
    /platform === "instagram"[\s\S]{0,80}\{ message: text \}/.test(engSrc),
    "attachment_share_url is a Pages parameter with no IG equivalent"
  );
  check(
    "the reply path feeds the post text to the model",
    /fetchPostContext\(e\.platform, e\.parentId/.test(botSrc),
    "without this, 'which shoe do you like: 2' reads as noise"
  );

  // ---- Shares -----------------------------------------------------------
  // Someone putting our post on their wall is the highest-value event
  // the webhook carries, and privacy decides how much of the thank-you
  // lands. Every refusal must be an answer, not an error.
  const sharePayload = {
    object: "page",
    entry: [
      {
        changes: [
          {
            field: "feed",
            value: {
              item: "share",
              post_id: "vbot-share-1",
              from: { id: "444", name: "A Sharer" },
              message: "these customs are insane, check this page out",
              parent_id: "vbot-orig-9",
            },
          },
          {
            field: "feed",
            value: { item: "share", post_id: "vbot-share-2", from: { id: "111000111", name: "Us" } },
          },
        ],
      },
    ],
  };
  const shares = parseWebhookPayload(sharePayload);
  check("a share of our post becomes an event", shares.some((s) => s.kind === "share" && s.objectId === "vbot-share-1"));
  check("the sharer's caption rides the event", shares[0]?.text === "these customs are insane, check this page out");
  check("the original post id rides as parentId", shares[0]?.parentId === "vbot-orig-9");
  check(
    "our own cross-post share is filtered out",
    !shares.some((s) => s.objectId === "vbot-share-2"),
    "without this the page thanks itself in public"
  );
  check(
    "the like leads and gates the rest",
    /likeObject\(e\.objectId\);\s*\n\s*if \(!liked\) return/.test(botSrc),
    "a refused like means the share isn't visible to us at all"
  );
  check(
    "no caption means no comment — the like stands alone",
    /caption && geminiConfigured\(\)/.test(botSrc),
    "if we can't read their wall we don't talk on it"
  );
  check(
    "a refused comment is swallowed, the like already said it",
    /catch \{\s*\n\s*\/\/ Comments closed/.test(botSrc)
  );
  check(
    "share thank-yous never carry a gif",
    !/extractGif/.test(
      botSrc.slice(botSrc.indexOf("async function maybeThankShare"), botSrc.indexOf("Messenger Profile"))
    ),
    "we're a guest on their wall"
  );
  check(
    "share likes count against the same hourly cap as comments",
    /autoNote: \{ in: \[SHARE_NOTE, SHARE_LIKE_NOTE\] \}/.test(botSrc),
    "a wall of instant likes reads as a machine just like comments do"
  );
  check(
    "the share brief bans selling on someone else's wall",
    /do not mention the giveaway/.test(botSrc)
  );

  // ---- The multi-vote roast --------------------------------------------
  check(
    "picking several when told to pick one gets called out",
    /MULTI-VOTERS/.test(DEFAULT_COMMENT_STYLE)
  );
  check(
    "and the callout is required to carry a lol so it lands as a joke",
    /soften the callout with lol or 😂/.test(DEFAULT_COMMENT_STYLE),
    "people get sensitive; the lol is load-bearing"
  );
  check(
    "the roast targets the vote, never the person",
    /never insult THEM/.test(DEFAULT_COMMENT_STYLE)
  );
}

main()
  .catch((e) => {
    fail++;
    log.push(`FAIL threw — ${e instanceof Error ? e.message : String(e)}`);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n=== THE BOT'S ROUTING BRAIN ===");
    for (const l of log) console.log(l);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });

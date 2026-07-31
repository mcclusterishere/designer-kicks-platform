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
import {
  keywordHit,
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

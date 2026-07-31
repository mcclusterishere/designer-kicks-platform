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
  DEFAULT_PERSONA,
  extractGif,
  humanize,
  keywordHit,
  parseGifLibrary,
  matchCommentFlow,
  matchMessageFlow,
  condenseThread,
  parseQuickReplies,
  situationBlock,
  wantsHuman,
  type FlowLite,
} from "../lib/chatbot";
import { parseWebhookPayload } from "../lib/metaEngage";
import { parseVoteChoice } from "../lib/shoeVision";

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
    "a digit range keeps its dash — a comma would change the claim",
    humanize("sizes 9–11 available, ships in 5–7 days") ===
      "sizes 9–11 available, ships in 5–7 days",
    humanize("sizes 9–11 available, ships in 5–7 days")
  );
  check(
    "a winky emoticon survives the semicolon rule",
    humanize("Nice ;)") === "Nice ;)",
    humanize("Nice ;)")
  );
  check(
    "a reply that opens with a dash doesn't open with a comma",
    humanize("— that colorway is nuts") === "that colorway is nuts",
    humanize("— that colorway is nuts")
  );
  check(
    "a DM's paragraph break survives the whitespace collapse",
    humanize("para one.\n\npara two.") === "para one.\n\npara two.",
    "blank lines are formatting, not sloppiness"
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
    "the brief tells the model to read the room before the comment",
    /READ THE SITUATION FIRST/.test(DEFAULT_COMMENT_STYLE) &&
      /follow the situation block over any assumption/.test(DEFAULT_COMMENT_STYLE)
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

  // ---- The giveaway pitch ----------------------------------------------
  // Entry moved from "DM us HEAT" to "make an account on the site" —
  // the giveaway is now the front door to accounts and streaks. And it
  // stays generic apparel: naming items invites promises we can't keep.
  check(
    "the comment pitch sends people to the site, not the DMs",
    /making an account at theheatchart\.com/.test(DEFAULT_COMMENT_STYLE)
  );
  check(
    "the DM persona thanks voters before anything else",
    /THANK THEM for the vote/.test(DEFAULT_PERSONA)
  );
  check(
    "the giveaway stays generic apparel — no item or brand names",
    /never name specific items or brands/i.test(DEFAULT_PERSONA) &&
      /never name specific giveaway items or brands/i.test(DEFAULT_COMMENT_STYLE)
  );
  check(
    "streaks are the retention hook in the DM pitch",
    /builds a streak/.test(DEFAULT_PERSONA)
  );
  check(
    "the persona still promises no prices, odds or deadlines",
    /Never invent prices, odds, deadlines or promises/.test(DEFAULT_PERSONA)
  );

  // ---- Vote parsing ------------------------------------------------------
  // Deterministic, free, runs on every comment. The lineup string is
  // exactly what identifyPostShoes produces.
  const LINEUP = "1 = Air Jordan 4 Bred; 2 = Dunk Low Panda; 3 = AF1 White";
  check("a bare digit is a vote", parseVoteChoice("2", LINEUP).shoe === "Dunk Low Panda");
  check('"the 2s" is a vote for 2', parseVoteChoice("the 2s all day", LINEUP).label === "2");
  check(
    "a written-out number counts",
    parseVoteChoice("two for sure", LINEUP).label === "2"
  );
  check(
    "naming the shoe outright resolves label AND name",
    parseVoteChoice("gotta be the dunk low panda", LINEUP).label === "2"
  );
  check(
    "a digit inside a shoe NAME doesn't miscount as a row vote",
    parseVoteChoice("air jordan 4 bred is my pick", LINEUP).shoe === "Air Jordan 4 Bred",
    "the 4 in 'jordan 4' is part of the name, not a vote for row 4"
  );
  check("a letter vote parses", parseVoteChoice("B", "A = X Shoe; B = Y Shoe").shoe === "Y Shoe");
  check(
    "an opinion without a pick stays null, not guessed",
    parseVoteChoice("these are all trash lol", LINEUP).label === null
  );
  check("no text, no vote", parseVoteChoice(null, LINEUP).label === null);
  check(
    "a vote with no lineup still keeps the label",
    parseVoteChoice("3", null).label === "3" && parseVoteChoice("3", null).shoe === null
  );

  // ---- Reading the room --------------------------------------------------
  // Not every post is a poll and not every post is about shoes. The
  // situation block is what tells the model which conversation it is
  // in, so these assert the wrong frame can never be handed over.
  const sb = (
    over: Partial<Parameters<typeof situationBlock>[0]> = {}
  ) =>
    situationBlock({
      platform: "facebook",
      brief: null,
      postText: null,
      thread: null,
      photo: null,
      fromName: "Dana",
      commentText: "these go hard",
      ...over,
    });

  const pollBlock = sb({
    brief: { kind: "poll", topic: null, lineup: "1 = Air Jordan 4 Bred; 2 = Dunk Low Panda" },
  });
  check(
    "a poll post is announced as a poll and carries its lineup",
    /pick-one poll/.test(pollBlock) && /Air Jordan 4 Bred/.test(pollBlock)
  );

  const offTopic = sb({
    brief: { kind: "off-topic", topic: "the owner's daughter graduating high school", lineup: null },
  });
  check(
    "an off-topic post says so, and names what it IS about",
    /NOT about sneakers/.test(offTopic) && /graduating high school/.test(offTopic)
  );
  check(
    "an off-topic post forbids steering back to shoes or selling",
    /Do not steer to sneakers/.test(offTopic) && /giveaway/.test(offTopic),
    "the giveaway pitch under somebody's funeral post is the failure this prevents"
  );
  check(
    "an off-topic post never leaks a poll frame",
    !/pick-one poll/.test(offTopic) && !/their comment is a vote/.test(offTopic)
  );

  const prompt = sb({
    brief: { kind: "photo-prompt", topic: "asking people to post their favorite pair", lineup: null },
  });
  check(
    "a photo-prompt post bans the pick-a-number question",
    /post their OWN photos/.test(prompt) && /never ask them to pick a number/.test(prompt)
  );

  const talk = sb({ brief: { kind: "shoe-talk", topic: "a new Dunk restock", lineup: null } });
  check(
    "a shoe post that isn't a poll says nobody is voting",
    /NOT a poll/.test(talk) && /Nobody is voting/.test(talk)
  );

  check(
    "an unreadable post does NOT default to the poll frame",
    /could not read this post/.test(sb()) && !/pick-one poll/.test(sb()),
    "guessing poll on an unknown post is what produced the wrong-room replies"
  );

  const pollNoLineup = sb({ brief: { kind: "poll", topic: null, lineup: null } });
  check(
    "a poll we couldn't read the lineup for forbids naming a shoe",
    /do not name a shoe you were not given/i.test(pollNoLineup)
  );

  const known = sb({ photo: { identified: "New Balance 990v6 Grey" } });
  check(
    "an identified commenter photo hands over the real name and asks for an open question",
    /New Balance 990v6 Grey/.test(known) && /open-ended question/.test(known)
  );
  const unknown = sb({ photo: { identified: null } });
  check(
    "an unidentified commenter photo explicitly forbids guessing the name",
    /could NOT identify/.test(unknown) && /Do NOT guess/.test(unknown),
    "a confident wrong shoe name is worse than no name"
  );

  check(
    "a photo comment with no words still reads as a comment",
    /no words, just the photo/.test(sb({ photo: { identified: null }, commentText: null }))
  );
  check(
    "the thread brief only appears when we actually read the thread",
    !/What else is being said/.test(sb()) &&
      /What else is being said/.test(sb({ thread: "5 people picked 1" }))
  );

  check(
    "the comment style tells the model to read the situation before assuming a poll",
    /READ THE SITUATION FIRST/.test(DEFAULT_COMMENT_STYLE) &&
      /Not every post is a poll/.test(DEFAULT_COMMENT_STYLE)
  );
  check(
    "the comment style no longer claims most posts are picks",
    !/Most of our posts are picks/.test(DEFAULT_COMMENT_STYLE),
    "that line is what made the bot force a vote frame onto every post"
  );
  check(
    "the comment style has a rule for photos people post of their own shoes",
    /WHEN THEY POSTED A PHOTO/.test(DEFAULT_COMMENT_STYLE) &&
      /open-ended question/.test(DEFAULT_COMMENT_STYLE)
  );
  check(
    "the comment style has a rule for posts that aren't about shoes",
    /WHEN THE POST ISN'T ABOUT SHOES/.test(DEFAULT_COMMENT_STYLE) &&
      /Match the room/.test(DEFAULT_COMMENT_STYLE)
  );
  check(
    "the comment style forbids inventing a shoe name it wasn't given",
    /NEVER INVENT/.test(DEFAULT_COMMENT_STYLE) &&
      /don't name a shoe you weren't told the name of/.test(DEFAULT_COMMENT_STYLE)
  );

  // ---- Somebody else's photo ---------------------------------------------
  // The most sensitive thing this bot touches. Meta's Platform Terms
  // only allow handing it to a third party that processes it solely at
  // our direction, and Google's unpaid tier trains on what it is sent.
  const visSrc = readFileSync(join(process.cwd(), "lib", "shoeVision.ts"), "utf8");
  const metaSrc = readFileSync(join(process.cwd(), "lib", "metaEngage.ts"), "utf8");
  const shopSrc = readFileSync(join(process.cwd(), "lib", "sneakerApi.ts"), "utf8");

  check(
    "a commenter's photo never reaches Gemini without the attestation",
    /platformDataAllowed\(\)/.test(visSrc) &&
      /if \(!geminiConfigured\(\) \|\| !platformDataAllowed\(\)\) return null;/.test(visSrc),
    "the unpaid tier trains on what it is sent, which breaks the service-provider clause"
  );
  check(
    "reading someone's photo never turns on search grounding",
    (() => {
      const fn = visSrc.slice(visSrc.indexOf("export async function readCommentPhoto"));
      const body = fn.slice(0, fn.indexOf("\n}\n"));
      return !/search:\s*true/.test(body);
    })(),
    "grounding is licensed for your own app shown to the asker, which a public comment is not"
  );
  check(
    "the sneaker lookup can be told to skip the grounded rung",
    /allowGrounding\?: boolean/.test(shopSrc) &&
      /if \(opts\.allowGrounding !== false\) chain\.push\(fromGemini\);/.test(shopSrc),
    "otherwise a comment could reach a grounded call whose answer gets persisted"
  );
  check(
    "comment attachments are read with the SINGULAR field",
    /attachment\{/.test(metaSrc) && !/fields.*attachments\{.*comment/i.test(metaSrc),
    "the plural attachments is the POST edge and returns nothing on a comment"
  );
  check(
    "an animated GIF is never mistaken for a photo of shoes",
    /animated/.test(metaSrc) &&
      /if \(t\.includes\("video"\) \|\| t\.includes\("animated"\)\) return false;/.test(metaSrc),
    "its image.src is a frozen preview frame, so the model would describe the wrong thing"
  );
  check(
    "an unrecognised attachment type is skipped, not assumed to be an image",
    /if \(mt !== "photo" && mt !== "image"\) return false;/.test(metaSrc)
  );
  check(
    "Instagram is excluded from the photo path at the door",
    /if \(platform !== "facebook"\) return null;/.test(metaSrc),
    "an IG comment has no attachment field at all, so there is nothing to fetch"
  );
  check(
    "a photo-only comment is no longer dropped before it is looked at",
    /const hasWords = Boolean\(e\.text/.test(botSrc) &&
      /if \(!hasWords && !mightHavePhoto\) return;/.test(botSrc),
    "the whole post-your-favourite-pair format is comments with no words"
  );
  check(
    "a photo of something that isn't footwear gets no shoe compliment",
    /if \(read\?\.isSneaker\)/.test(botSrc),
    "complimenting someone's sneakers under a picture of their dog"
  );
  check(
    "the photo read is not kept against the person who posted it",
    !/commentPhoto.*create|photoRead.*prisma|prisma.*photoRead/i.test(botSrc),
    "per-person collection profiles from Platform Data need consent we do not have"
  );

  // ---- The model ladder --------------------------------------------------
  // Every reply on the page rides this. A shut-down model id in the
  // chain is not a warning, it is a guaranteed failed request.
  const gemSrc = readFileSync(join(process.cwd(), "lib", "gemini.ts"), "utf8");
  // Scan the ladder ARRAY, not the whole file: the comments above it
  // name the dead model on purpose, to say why it was removed.
  const ladder = gemSrc.match(/const MODEL_LADDER = \[([^\]]*)\]/)?.[1] ?? "";
  check(
    "the model that Google shut down in June is gone from the ladder",
    ladder.length > 0 && !ladder.includes("gemini-2.0-flash"),
    "it was the safety net, which made the net a guaranteed second failure"
  );
  check(
    "a lite model leads the ladder and a known-good one backstops it",
    ladder.includes("gemini-3.1-flash-lite") &&
      ladder.includes("gemini-2.5-flash") &&
      ladder.indexOf("gemini-3.1-flash-lite") < ladder.indexOf("gemini-2.5-flash"),
    "being wrong about a new id costs one failed request, not an outage"
  );
  check(
    "the ladder remembers which rung answered",
    /workingModel = model;/.test(gemSrc) &&
      /\[workingModel, \.\.\.MODEL_LADDER\.filter/.test(gemSrc),
    "without this a dead id at the top taxes every call for the life of the process"
  );
  check(
    "GEMINI_MODEL still pins one model and skips the ladder",
    /if \(process\.env\.GEMINI_MODEL\) return \[process\.env\.GEMINI_MODEL\];/.test(gemSrc)
  );
  check(
    "both the json and the chat path use the same ladder",
    (gemSrc.match(/const models = modelLadder\(\);/g) ?? []).length === 2,
    "the chat path is what answers comments, so it cannot keep its own stale list"
  );

  check(
    "the public reply reads the post brief, not just the lineup",
    botSrc.includes("describePost") && botSrc.includes("situationBlock({"),
    "the reply prompt is built from the brief so off-topic posts get an off-topic frame"
  );

  // ---- Knowing the rest of the room --------------------------------------
  // The tally comes from votes we already banked, so it costs a query
  // rather than a Graph call per commenter.
  const row = (over: Partial<Parameters<typeof condenseThread>[0][number]>) => ({
    rawText: "whatever",
    choiceLabel: null,
    shoeName: null,
    commentId: "c" + Math.random().toString(36).slice(2),
    ...over,
  });
  const thread = [
    row({ commentId: "mine", rawText: "1 for me", choiceLabel: "1", shoeName: "Air Jordan 4 Bred" }),
    row({ rawText: "gotta be the 4s", choiceLabel: "1", shoeName: "Air Jordan 4 Bred" }),
    row({ rawText: "2 all day", choiceLabel: "2", shoeName: "Dunk Low Panda" }),
    row({ rawText: "these are all trash", choiceLabel: null }),
  ];

  check("one other voice is not a thread", condenseThread(thread.slice(0, 2), "mine") === null);

  const brief3 = condenseThread(thread, "mine") ?? "";
  check(
    "the thread brief excludes the comment being answered",
    !/1 for me/.test(brief3) && /3 other people have commented/.test(brief3),
    "quoting someone their own comment back as 'what people are saying' reads broken"
  );
  check(
    "the running count names the shoe, not just the number",
    /Air Jordan 4 Bred \(1\) has 1/.test(brief3) && /Dunk Low Panda \(2\) has 1/.test(brief3)
  );
  check(
    "comments with no pick are counted, not dropped",
    /1 said something without picking/.test(brief3),
    "an opinion with no vote is still part of the mood"
  );
  check(
    "the brief samples what people actually wrote",
    /"2 all day"/.test(brief3) && /"these are all trash"/.test(brief3)
  );
  check(
    "the leading option is listed first",
    (() => {
      const lead = condenseThread(
        [
          row({ choiceLabel: "2", shoeName: "Dunk Low Panda" }),
          row({ choiceLabel: "1", shoeName: "Air Jordan 4 Bred" }),
          row({ choiceLabel: "1", shoeName: "Air Jordan 4 Bred" }),
        ],
        null
      ) ?? "";
      return lead.indexOf("Air Jordan 4 Bred") < lead.indexOf("Dunk Low Panda");
    })()
  );
  check(
    "the brief tells the model not to repeat what we said to someone else",
    /avoid repeating what we already said/.test(brief3)
  );
  check(
    "the public reply actually reads the thread before answering",
    botSrc.includes("threadBrief(e.parentId"),
    "the tally is useless if the reply never sees it"
  );
  check(
    "the thread is read from our own banked votes, not a Graph call per comment",
    /prisma\.socialVote\.findMany/.test(botSrc) &&
      !/fetchThread|graph\(.*comments/.test(botSrc),
    "reading the thread from Meta on every comment is how a Page gets rate limited"
  );

  // Structure: votes are banked BEFORE the reply caps, and the ticket
  // is appended by code, never regenerated by the model.
  check(
    "votes are recorded before any cap can drop them",
    botSrc.indexOf("recordPollVote(e)") < botSrc.indexOf("matchCommentFlow(flows, e.text"),
    "the caps bound what we send, not what we learn"
  );
  check(
    "the ticket text is appended verbatim after the AI intro",
    /return `\$\{intro\}\\n\\n\$\{base\}`/.test(botSrc),
    "the model writes the greeting only — it cannot drop or mangle the entry link"
  );
  check(
    "a skipped or oversized intro falls back to the flow's own words",
    /\/\^skip\\b\/i\.test\(intro\) \|\| intro\.length > 320/.test(botSrc)
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

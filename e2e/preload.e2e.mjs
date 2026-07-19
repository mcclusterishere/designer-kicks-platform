// Onboarding accelerator: admin pre-loads an artist + shoe, gets a
// claim link and outreach DM; the artist claims the account via the
// link and lands as an approved artist.
import { PrismaClient } from "@prisma/client";
import { BASE, SHOTS, PNG_1x1, ADMIN_PASSWORD, makeChecker, launchBrowser } from "./helpers.mjs";

try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const EMAIL = "preload-e2e@test.example";
const results = [];
const check = makeChecker(results);

const EMAIL2 = "preload-merge2@test.example";
await prisma.submission.deleteMany({ where: { email: EMAIL } });
await prisma.user.deleteMany({ where: { email: { in: [EMAIL, EMAIL2] } } });

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Admin pre-loads the artist
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.fill("#password", ADMIN_PASSWORD);
await page.getByRole("button", { name: "Enter" }).click();
await page.getByText("Pre-load An Artist").waitFor({ timeout: 10000 });

await page.fill("#pl-name", "Preload Test Artist");
await page.fill("#pl-email", EMAIL);
await page.fill("#pl-ig", "@preloadtest");
await page.fill("#pl-title", "Preload Test Custom");
await page.fill("#pl-base", "Dunk High");
await page.setInputFiles("#pl-img", { name: "p.png", mimeType: "image/png", buffer: PNG_1x1 });
await page.getByRole("button", { name: "Pre-load Artist + Piece" }).click();
await page.getByText("Artist is live").waitFor({ timeout: 15000 });
check("preload succeeds with live confirmation", true);

const claimUrl = await page.locator("input[readonly]").first().inputValue();
check("claim link generated", /\/reset-password\/[a-f0-9]{64}/.test(claimUrl));
const dmText = await page.locator("textarea[readonly]").inputValue();
check("outreach DM includes artist page + claim link", dmText.includes("/artists/") && dmText.includes("/reset-password/"));
await page.screenshot({ path: `${SHOTS}/preload-result.png`, fullPage: false });

// Artist + shoe are live and votable-ready
const artist = await prisma.artistProfile.findFirst({
  where: { displayName: "Preload Test Artist" },
  include: { submissions: true },
});
check("artist profile approved", artist?.status === "APPROVED");
check("shoe pre-approved", artist?.submissions?.[0]?.status === "APPROVED");

await page.goto(`${BASE}/artists/${artist.slug}`, { waitUntil: "networkidle" });
check("public artist page live", await page.getByText("Preload Test Custom").isVisible());

// ---- Claim flow: the real artist asserts ownership, admin verifies ----
check("unclaimed page invites a claim", await page.getByRole("button", { name: "Claim This Page" }).isVisible());
await page.getByRole("button", { name: "Claim This Page" }).click();

// The claim terminal: one question at a time, Enter/next to advance.
const claimInput = page.locator("[data-testid=claim-input]");
const claimNext = page.locator("[data-testid=claim-next]");
async function answer(text) {
  await claimInput.fill(text);
  await claimNext.click();
}
check("terminal onboarding opens", await claimInput.isVisible());
await answer("Preload Test Artist"); // name
await answer(EMAIL); // email (login)
await answer("719-555-0134"); // phone — seller non-negotiable
await answer(""); // business name — optional skip
await answer("P.O. Box 12"); // the guard must refuse this
check(
  "P.O. Box refused with the privacy promise",
  await page.getByText("It stays private, promise").isVisible()
);
await answer("417 W Test Ave"); // real street address
await answer("Pueblo"); // city
await answer("CO"); // state
await answer("81005"); // zip
await answer("@preloadtest"); // proof
await answer(""); // message — optional skip
await page.getByRole("button", { name: "Submit Claim For Verification" }).click();
await page.getByText("Claim received ✓").waitFor({ timeout: 15000 });
const claimRow = await prisma.artistClaim.findFirst({ where: { artistId: artist.id } });
check("claim lands PENDING in the queue", claimRow?.status === "PENDING");
check(
  "seller non-negotiables captured",
  claimRow?.phone === "719-555-0134" &&
    claimRow?.addressLine === "417 W Test Ave" &&
    claimRow?.city === "Pueblo" &&
    claimRow?.zip === "81005"
);

// ---- Airtight onboarding: paste-splitting, back button, edit-jump, merge ----
// A second walk from the same email: the whole address pasted into the
// street box must split itself, back must prefill, editing must jump
// back to review, and the duplicate claim must MERGE, not dead-end.
await page.goto(`${BASE}/artists/${artist.slug}`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Claim This Page" }).click();
await answer("Preload Test Artist");
await answer(EMAIL);
await answer("719-555-0134");
await answer(""); // business skip
await answer("500 Merge Blvd, Pueblo, CO 81005"); // whole address pasted
check("full address auto-splits", await page.getByText("split it into street / city / state / ZIP").isVisible());
check("split street in transcript", await page.getByRole("button", { name: "❯ 500 Merge Blvd" }).isVisible());
check("split zip in transcript", await page.getByRole("button", { name: "❯ 81005" }).isVisible());
// back button lands on ZIP with the answer prefilled
await page.locator("[data-testid=claim-back]").click();
check("back prefills the saved answer", (await claimInput.inputValue()) === "81005");
await claimNext.click(); // confirm zip again → straight back to proof
await answer("@preloadtest");
await answer(""); // message skip → review
// tap an old answer, fix it, and land straight back on review
await page.getByRole("button", { name: "❯ 719-555-0134" }).click();
check("transcript edit prefills", (await claimInput.inputValue()) === "719-555-0134");
await answer("719-555-9999");
check(
  "edit jumps straight back to review",
  await page.getByRole("button", { name: "Submit Claim For Verification" }).isVisible()
);
await page.getByRole("button", { name: "Submit Claim For Verification" }).click();
await page.getByText("Claim received ✓").waitFor({ timeout: 15000 });
check("duplicate claim merges instead of duping", await page.getByText(/merged in your newest answers/).isVisible());
const mergedClaims = await prisma.artistClaim.findMany({ where: { artistId: artist.id, email: EMAIL } });
check(
  "one claim row, refreshed with newest info",
  mergedClaims.length === 1 &&
    mergedClaims[0].addressLine === "500 Merge Blvd" &&
    mergedClaims[0].phone === "719-555-9999" &&
    mergedClaims[0].zip === "81005"
);
await page.screenshot({ path: `${SHOTS}/claim-merge.png`, fullPage: false });

// A second person claims from a different email — stays a separate row.
await page.goto(`${BASE}/artists/${artist.slug}`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Claim This Page" }).click();
await answer("Second Claimer");
await answer(EMAIL2);
await answer("719-555-0200");
await answer("");
await answer("9 Rival St");
await answer("Pueblo");
await answer("co"); // lowercase on purpose — must store as CO
await answer("81005");
await answer("@secondclaimer");
await answer("");
await page.getByRole("button", { name: "Submit Claim For Verification" }).click();
await page.getByText("Claim received ✓").waitFor({ timeout: 15000 });
const rivalClaim = await prisma.artistClaim.findFirst({ where: { email: EMAIL2 } });
check("different email files its own claim", rivalClaim?.status === "PENDING");
check("state normalized to uppercase", rivalClaim?.state === "CO");

// Registering with a pre-loaded page's email must NOT hand the page
// over before the league verifies a claim... (fresh context — the main
// page must stay session-free for the signin checks later)
const regCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const reg = await regCtx.newPage();
await reg.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await reg.fill("#name", "Preload Test Artist");
await reg.fill("#email", EMAIL);
await reg.fill("#password", "registerpass1");
await reg.getByRole("button", { name: "Create Account" }).click();
// React 19 resets the form when the action resolves — wait for the
// refusal to land before typing the next registration into it.
await reg.getByText(/hasn't been claimed yet/).waitFor({ timeout: 15000 });
check("unverified email can't grab the page via register", true);
// ...but registering with a PENDING claim from a fresh email works and
// says the claim will hook up on approval.
await reg.fill("#name", "Second Claimer");
await reg.fill("#email", EMAIL2);
await reg.fill("#password", "registerpass2");
await reg.getByRole("button", { name: "Create Account" }).click();
await reg.locator("[data-testid=register-note]").waitFor({ timeout: 15000 });
check("pending claim surfaced at signup", await reg.getByText(/still in review/).isVisible());
await regCtx.close();

await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.getByText("Profile Claims").waitFor({ timeout: 10000 });
check("claim visible to admin", await page.getByText("@preloadtest").first().isVisible());
check(
  "private seller info shown to admin only",
  await page.getByText("Seller info — private, admin only").first().isVisible()
);
// Two claims are pending (the merged one + the rival) — approve the
// merged claim from the artist's real email specifically.
await page
  .locator("div.rounded-xl", { hasText: `· ${EMAIL}` })
  .getByRole("button", { name: "Verify & Hand Over" })
  .click();
await page.getByText("approved ✓").waitFor({ timeout: 15000 });
const verdict = await prisma.artistClaim.findUnique({ where: { id: claimRow.id } });
check("admin approval closes the claim", verdict?.status === "APPROVED");

check(
  "approval auto-rejects the rival claim",
  (await prisma.artistClaim.findUnique({ where: { id: rivalClaim.id } }))?.status === "REJECTED"
);

// The verified email can now create the account by plain registration —
// the approved claim is the proof, and the page comes along (merge).
// Fresh context: the main page is signed in as the second claimer.
const adoptCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const adopt = await adoptCtx.newPage();
await adopt.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await adopt.fill("#name", "Preload Test Artist");
await adopt.fill("#email", EMAIL);
await adopt.fill("#password", "adoptedpass1");
await adopt.getByRole("button", { name: "Create Account" }).click();
await adopt.locator("[data-testid=register-note]").waitFor({ timeout: 15000 });
check("verified register adopts the artist page", await adopt.getByText(/it's yours now/).isVisible());
await adoptCtx.close();

// Artist claims the account through the link
const claimPath = new URL(claimUrl).pathname;
await page.goto(`${BASE}${claimPath}`, { waitUntil: "networkidle" });
await page.fill("#password", "claimedpass99");
await page.getByRole("button", { name: "Set New Password" }).click();
await page.getByText("Password updated.").waitFor({ timeout: 10000 });
check("claim link sets a password", true);

await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", "claimedpass99");
await page.getByRole("button", { name: "Sign In", exact: true }).click();
await page.waitForURL("**/profile", { timeout: 15000 });
check("claimed artist can sign in", true);

await page.goto(`${BASE}/submit`, { waitUntil: "networkidle" });
check("claimed account is an approved artist", await page.getByText("approved artist").isVisible());

// Once claimed, the page stops inviting claims
await page.goto(`${BASE}/artists/${artist.slug}`, { waitUntil: "networkidle" });
check("claim banner gone after handover", !(await page.getByRole("button", { name: "Claim This Page" }).isVisible()));

// ---- Multi-piece preload: same email stacks pieces on one profile ----
// (Run BEFORE claim it would reuse the same token; after claim it must
// skip the claim link entirely and not break the account.)
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.getByText("Pre-load An Artist").waitFor({ timeout: 10000 });
await page.fill("#pl-name", "Preload Test Artist");
await page.fill("#pl-email", EMAIL);
await page.fill("#pl-title", "Preload Second Piece");
await page.fill("#pl-base", "Air Max 95");
await page.fill("#pl-size", "US 11");
await page.setInputFiles("#pl-img", { name: "p2.png", mimeType: "image/png", buffer: PNG_1x1 });
await page.getByRole("button", { name: "Pre-load Artist + Piece" }).click();
await page.getByText("New piece added").waitFor({ timeout: 15000 });
check("second preload adds to the existing page", await page.getByText("already claimed their account").isVisible());

const stacked = await prisma.artistProfile.findMany({
  where: { user: { email: EMAIL } },
  include: { submissions: true },
});
check("one profile, two pieces", stacked.length === 1 && stacked[0].submissions.length === 2);
check("size stored on the stacked piece", stacked[0].submissions.some((s) => s.size === "US 11"));
const claimedUser = await prisma.user.findUnique({ where: { email: EMAIL } });
check("claimed password untouched by re-preload", Boolean(claimedUser?.passwordHash));

// ---- Category walls: hats never face shoes, anywhere a matchup forms ----
const wallKicks = await prisma.submission.create({
  data: { title: "Wall Kicks", artistName: "Preload Test Artist", email: EMAIL, baseShoe: "AF1", imageUrl: "/seed/custom-1.svg", status: "APPROVED", category: "sneakers", artistId: artist.id },
});
const wallChain = await prisma.submission.create({
  data: { title: "Wall Chain", artistName: "Preload Test Artist", email: EMAIL, baseShoe: "Cuban link", imageUrl: "/seed/custom-2.svg", status: "APPROVED", category: "accessories", artistId: artist.id },
});
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await page.getByText("Start a Battle", { exact: false }).first().waitFor({ timeout: 10000 }).catch(() => {});
await page.selectOption("#subAId", wallChain.id);
check("side B announces the wall", await page.getByText(/Accessories only — category wall/).isVisible());
const sideBTexts = await page.locator("#subBId option").allTextContents();
check("sneakers walled out of side B", !sideBTexts.some((t) => t.includes("Wall Kicks")));
const chainBox = page.locator(`input[name="participants"][value="${wallChain.id}"]`);
await chainBox.check();
const kickBox = page.locator(`input[name="participants"][value="${wallKicks.id}"]`);
check("tournament picker grays the other lane", await kickBox.isDisabled());
check("bracket announces its lane", await page.getByText("Accessories bracket — category wall is on.").isVisible());
await page.screenshot({ path: `${SHOTS}/category-walls.png`, fullPage: false });
check(
  "no cross-category battles exist anywhere",
  (await prisma.$queryRaw`SELECT count(*)::int AS n FROM "Battle" b JOIN "Submission" sa ON b."subAId"=sa.id JOIN "Submission" sb ON b."subBId"=sb.id WHERE sa.category <> sb.category`)[0].n === 0
);

// Cleanup
await prisma.submission.deleteMany({ where: { email: EMAIL } });
await prisma.user.deleteMany({ where: { email: { in: [EMAIL, EMAIL2] } } });

await browser.close();
await prisma.$disconnect();
console.log(results.join("\n"));

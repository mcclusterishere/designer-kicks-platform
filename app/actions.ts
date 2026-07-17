"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import {
  checkPassword,
  setAdminSession,
  clearAdminSession,
  isAdmin,
  adminLoginAvailable,
  registerLoginAttempt,
} from "@/lib/admin";
import { headers } from "next/headers";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { slugify } from "@/lib/articles";
import { uniqueArtistSlug, ensureCollectorSlug } from "@/lib/artists";
import { createTournament } from "@/lib/tournaments";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID, randomInt, randomBytes } from "crypto";
import { saveUpload } from "@/lib/storage";
import { sendMail } from "@/lib/mailer";
import { allowAttempt } from "@/lib/ratelimit";

export type ActionResult = { ok: boolean; error?: string };

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// ---------- Submissions ----------

export async function createSubmission(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to submit your customs." };
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { ok: false, error: "Sign in to submit your customs." };

  const title = String(formData.get("title") ?? "").trim();
  const artistName = String(formData.get("artistName") ?? "").trim();
  const socialHandle = String(formData.get("socialHandle") ?? "").trim().replace(/^@/, "");
  const baseShoe = String(formData.get("baseShoe") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const image = formData.get("image");

  if (!title || title.length > 80) return { ok: false, error: "Give your custom a name (max 80 characters)." };
  if (!artistName || artistName.length > 60) return { ok: false, error: "Artist / crew name is required." };
  if (!baseShoe) return { ok: false, error: "Tell us the base shoe (e.g. Air Force 1, Dunk Low)." };
  if (description.length > 600) return { ok: false, error: "Description is too long (max 600 characters)." };

  if (!(image instanceof File) || image.size === 0) return { ok: false, error: "Upload a photo of your custom." };
  if (image.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Photo must be under 6MB." };
  const ext = ALLOWED_TYPES[image.type];
  if (!ext) return { ok: false, error: "Photo must be a JPG, PNG, or WebP." };

  if (!allowAttempt("submit", user.id, 10, 60 * 60 * 1000)) {
    return { ok: false, error: "That's a lot of submissions — try again in an hour." };
  }

  // Submitting requires an APPROVED artist account (fan accounts apply
  // and get reviewed first).
  const artist = await prisma.artistProfile.findUnique({ where: { userId: user.id } });
  if (!artist || artist.status !== "APPROVED") {
    return {
      ok: false,
      error:
        artist?.status === "PENDING"
          ? "Your artist application is still under review."
          : "You need an approved artist account to submit — apply on this page.",
    };
  }

  const fileName = `${randomUUID()}.${ext}`;
  const imageUrl = await saveUpload(
    Buffer.from(await image.arrayBuffer()),
    fileName,
    image.type
  );

  await prisma.submission.create({
    data: {
      title,
      artistName: artist.displayName,
      socialHandle: artist.instagram ?? (socialHandle || null),
      email: user.email,
      baseShoe,
      description: description || null,
      imageUrl,
      artistId: artist.id,
    },
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function applyForArtist(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in first." };

  const displayName = String(formData.get("displayName") ?? "").trim();
  const instagram = String(formData.get("instagram") ?? "").trim().replace(/^@/, "");
  const city = String(formData.get("city") ?? "").trim();
  const portfolioUrl = String(formData.get("portfolioUrl") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();

  if (!displayName || displayName.length > 60) return { ok: false, error: "Artist / crew name is required." };
  if (portfolioUrl && !/^https?:\/\//.test(portfolioUrl)) {
    return { ok: false, error: "Portfolio link must start with http(s)://" };
  }
  if (bio.length > 400) return { ok: false, error: "Bio is too long (max 400 characters)." };

  const existing = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (existing?.status === "PENDING") return { ok: false, error: "Your application is already under review." };
  if (existing?.status === "APPROVED") return { ok: false, error: "You already have an approved artist account." };

  const data = {
    displayName,
    instagram: instagram || null,
    city: city || null,
    portfolioUrl: portfolioUrl || null,
    bio: bio || null,
    status: "PENDING",
  };

  if (existing) {
    // Rejected applicants can reapply with updated info.
    await prisma.artistProfile.update({ where: { id: existing.id }, data });
  } else {
    await prisma.artistProfile.create({
      data: { ...data, userId: session.user.id, slug: await uniqueArtistSlug(displayName) },
    });
  }

  // No revalidatePath at all: every affected page is force-dynamic, and
  // any revalidation would rerender /submit into its PENDING view before
  // the client confirmation card can show.
  return { ok: true };
}

export type PreloadResult = ActionResult & {
  artistSlug?: string;
  claimUrl?: string;
  inviteText?: string;
  emailSent?: boolean;
};

/**
 * Onboarding accelerator: admin creates an artist's page + first shoe
 * on their behalf (with permission), already approved and votable. The
 * artist gets a claim link (14-day password-set token) so the account
 * becomes theirs in one tap — plus a ready-to-send invite message, and
 * an automatic email when a mail provider is configured.
 */
export async function preloadArtist(
  _prev: PreloadResult | null,
  formData: FormData
): Promise<PreloadResult> {
  await requireAdmin();

  const artistName = String(formData.get("artistName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const instagram = String(formData.get("instagram") ?? "").trim().replace(/^@/, "");
  const city = String(formData.get("city") ?? "").trim();
  const shoeTitle = String(formData.get("shoeTitle") ?? "").trim();
  const baseShoe = String(formData.get("baseShoe") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const image = formData.get("image");

  if (!artistName) return { ok: false, error: "Artist name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "A valid artist email is required (it becomes their claimable account)." };
  if (!shoeTitle || !baseShoe) return { ok: false, error: "Shoe title and base shoe are required." };
  if (!(image instanceof File) || image.size === 0) return { ok: false, error: "Upload a photo of the custom." };
  if (image.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Photo must be under 6MB." };
  const ext = ALLOWED_TYPES[image.type];
  if (!ext) return { ok: false, error: "Photo must be a JPG, PNG, or WebP." };

  // Claimable account: no password until the artist sets one via the link.
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: artistName, email },
  });

  let artist = await prisma.artistProfile.findUnique({ where: { userId: user.id } });
  if (!artist) {
    artist = await prisma.artistProfile.create({
      data: {
        userId: user.id,
        slug: await uniqueArtistSlug(artistName),
        displayName: artistName,
        instagram: instagram || null,
        city: city || null,
        status: "APPROVED",
      },
    });
  } else if (artist.status !== "APPROVED") {
    artist = await prisma.artistProfile.update({
      where: { id: artist.id },
      data: { status: "APPROVED" },
    });
  }

  const fileName = `${randomUUID()}.${ext}`;
  const imageUrl = await saveUpload(Buffer.from(await image.arrayBuffer()), fileName, image.type);

  await prisma.submission.create({
    data: {
      title: shoeTitle,
      artistName: artist.displayName,
      socialHandle: artist.instagram,
      email,
      baseShoe,
      description: description || null,
      imageUrl,
      status: "APPROVED",
      artistId: artist.id,
    },
  });

  // 14-day claim token (rides the password-reset flow).
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
  });

  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const artistUrl = `${base}/artists/${artist.slug}`;
  const claimUrl = `${base}/reset-password/${token}`;
  const inviteText =
    `Yo ${artistName} — your customs are officially in the arena on Designer Kicks 🔥\n\n` +
    `The culture votes on head-to-head custom battles, and "${shoeTitle}" is already live on your artist page:\n${artistUrl}\n\n` +
    `Claim your account here (sets your password, takes 30 seconds):\n${claimUrl}\n\n` +
    `Every battle builds your W–L record on the league table, fans can follow you, and when you sell a pair you can transfer it to the buyer's collector closet. Come defend your heat.`;

  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    const { delivered } = await sendMail({
      to: email,
      subject: `${artistName} — your customs are live on Designer Kicks 🔥`,
      text: inviteText,
    });
    emailSent = delivered;
  }

  revalidatePath("/artists");
  revalidatePath(`/artists/${artist.slug}`);
  revalidatePath("/admin");
  return { ok: true, artistSlug: artist.slug, claimUrl, inviteText, emailSent };
}

export async function setArtistStatus(id: string, status: "APPROVED" | "REJECTED") {
  await requireAdmin();
  await prisma.artistProfile.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
  revalidatePath("/artists");
  revalidatePath("/submit");
}

/**
 * Records a sale/transfer of a one-of-one to a fan's closet. Allowed
 * for the shoe's artist (marking their own sale) or an admin.
 */
export async function transferOwnership(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  const submissionId = String(formData.get("submissionId") ?? "");
  const buyerEmail = String(formData.get("buyerEmail") ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return { ok: false, error: "Enter the buyer's account email." };
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { artist: true },
  });
  if (!submission) return { ok: false, error: "Shoe not found." };

  const isArtistOwner =
    session?.user?.id && submission.artist?.userId === session.user.id;
  if (!isArtistOwner && !(await isAdmin())) {
    return { ok: false, error: "Only the artist (or an admin) can transfer this piece." };
  }

  const buyer = await prisma.user.findUnique({ where: { email: buyerEmail } });
  if (!buyer) {
    return { ok: false, error: "No member with that email — the buyer needs a free fan account first." };
  }
  if (submission.artist && buyer.id === submission.artist.userId) {
    return { ok: false, error: "That's the artist's own account." };
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: { ownerId: buyer.id },
  });
  const collectorSlug = await ensureCollectorSlug(buyer.id);

  if (submission.artist) revalidatePath(`/artists/${submission.artist.slug}`);
  revalidatePath(`/collectors/${collectorSlug}`);
  revalidatePath("/profile");
  return { ok: true };
}

export async function toggleFollowArtist(artistId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to follow artists." };

  const existing = await prisma.artistFollow.findUnique({
    where: { artistId_userId: { artistId, userId: session.user.id } },
  });
  if (existing) {
    await prisma.artistFollow.delete({ where: { id: existing.id } });
  } else {
    await prisma.artistFollow.create({
      data: { artistId, userId: session.user.id },
    });
  }

  const artist = await prisma.artistProfile.findUnique({ where: { id: artistId } });
  if (artist) revalidatePath(`/artists/${artist.slug}`);
  revalidatePath("/artists");
  return { ok: true };
}

// ---------- Voting ----------

export async function castVote(battleId: string, submissionId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to vote — it takes 10 seconds and your vote counts." };
  }
  if (!allowAttempt("vote", session.user.id, 30, 60 * 1000)) {
    return { ok: false, error: "Slow down — try again in a minute." };
  }

  await finalizeExpiredBattles();

  const battle = await prisma.battle.findUnique({ where: { id: battleId } });
  if (!battle) return { ok: false, error: "Battle not found." };
  if (battle.status !== "ACTIVE") return { ok: false, error: "This battle has ended." };
  if (submissionId !== battle.subAId && submissionId !== battle.subBId) {
    return { ok: false, error: "That shoe isn't in this battle." };
  }

  const voterKey = session.user.id;
  try {
    await prisma.vote.create({
      data: { battleId, submissionId, voterKey, userId: session.user.id },
    });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, error: "You already voted in this battle." };
    }
    throw e;
  }

  revalidatePath(`/battles/${battleId}`);
  revalidatePath("/battles");
  revalidatePath("/");
  return { ok: true };
}

// ---------- Admin ----------

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin");
}

export async function adminLogin(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  if (!adminLoginAvailable()) {
    return { ok: false, error: "Admin login is disabled — set ADMIN_PASSWORD on the server." };
  }

  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!registerLoginAttempt(ip)) {
    return { ok: false, error: "Too many attempts — try again in 15 minutes." };
  }

  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) return { ok: false, error: "Wrong password." };
  await setAdminSession();
  revalidatePath("/admin");
  return { ok: true };
}

export async function adminLogout() {
  await clearAdminSession();
  revalidatePath("/admin");
}

export async function setSubmissionStatus(id: string, status: "APPROVED" | "REJECTED") {
  await requireAdmin();
  await prisma.submission.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
  revalidatePath("/heat-list");
}

export async function createBattle(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const subAId = String(formData.get("subAId") ?? "");
  const subBId = String(formData.get("subBId") ?? "");
  const days = Number(formData.get("days") ?? 7);
  const title = String(formData.get("title") ?? "").trim();

  if (!subAId || !subBId) return { ok: false, error: "Pick two shoes." };
  if (subAId === subBId) return { ok: false, error: "A shoe can't battle itself." };
  if (!Number.isFinite(days) || days < 1 || days > 30) return { ok: false, error: "Battle length must be 1–30 days." };

  const [a, b] = await Promise.all([
    prisma.submission.findUnique({ where: { id: subAId } }),
    prisma.submission.findUnique({ where: { id: subBId } }),
  ]);
  if (!a || !b || a.status !== "APPROVED" || b.status !== "APPROVED") {
    return { ok: false, error: "Both shoes must be approved submissions." };
  }

  await prisma.battle.create({
    data: {
      subAId,
      subBId,
      title: title || null,
      endsAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
  });

  revalidatePath("/battles");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

export async function endBattleNow(battleId: string) {
  await requireAdmin();
  await prisma.battle.update({
    where: { id: battleId },
    data: { endsAt: new Date(Date.now() - 1000) },
  });
  await finalizeExpiredBattles();
  revalidatePath("/battles");
  revalidatePath("/admin");
  revalidatePath("/heat-list");
}

export async function saveProduct(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const merchant = String(formData.get("merchant") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const blurb = String(formData.get("blurb") ?? "").trim();
  const price = String(formData.get("price") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const affiliateUrl = String(formData.get("affiliateUrl") ?? "").trim();
  const featured = formData.get("featured") === "on";

  if (!name || !merchant || !affiliateUrl) return { ok: false, error: "Name, merchant, and link are required." };
  if (!/^https?:\/\//.test(affiliateUrl)) return { ok: false, error: "Link must start with http(s)://" };

  const data = {
    name,
    merchant,
    category: category || "accessories",
    blurb: blurb || null,
    price: price || null,
    imageUrl: imageUrl || null,
    affiliateUrl,
    featured,
  };

  if (id) {
    await prisma.product.update({ where: { id }, data });
  } else {
    await prisma.product.create({ data });
  }

  revalidatePath("/shop");
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  await prisma.product.delete({ where: { id } });
  revalidatePath("/shop");
  revalidatePath("/admin");
}

// ---------- Newsroom ----------

export async function saveArticle(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const coverImage = String(formData.get("coverImage") ?? "").trim();
  const tags = String(formData.get("tags") ?? "").trim();
  const publish = formData.get("publish") === "on";

  if (!title || title.length > 120) return { ok: false, error: "Title is required (max 120 characters)." };
  if (!excerpt || excerpt.length > 200) return { ok: false, error: "Excerpt is required (max 200 characters) — it's also the meta description." };
  if (!content) return { ok: false, error: "Article body is required." };

  const slug = slugify(rawSlug || title);
  if (!slug) return { ok: false, error: "Couldn't derive a URL slug from that title." };

  const clash = await prisma.article.findUnique({ where: { slug } });
  if (clash && clash.id !== id) return { ok: false, error: `Slug "${slug}" is already used by another article.` };

  const data = {
    title,
    slug,
    excerpt,
    content,
    coverImage: coverImage || null,
    tags: tags || null,
    status: publish ? "PUBLISHED" : "DRAFT",
  };

  if (id) {
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Article not found." };
    await prisma.article.update({
      where: { id },
      data: {
        ...data,
        // Stamp publishedAt on the first publish; keep the original date on edits.
        publishedAt: publish ? existing.publishedAt ?? new Date() : existing.publishedAt,
      },
    });
  } else {
    await prisma.article.create({
      data: { ...data, publishedAt: publish ? new Date() : null },
    });
  }

  revalidatePath("/news");
  revalidatePath(`/news/${slug}`);
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteArticle(id: string) {
  await requireAdmin();
  await prisma.article.delete({ where: { id } });
  revalidatePath("/news");
  revalidatePath("/admin");
}

// ---------- Tournaments ----------

export async function createTournamentAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const prize = String(formData.get("prize") ?? "").trim();
  const size = Number(formData.get("size"));
  const roundDays = Number(formData.get("roundDays") ?? 3);
  const participants = formData.getAll("participants").map(String);

  if (!name || name.length > 80) return { ok: false, error: "Tournament name is required." };
  if (![4, 8, 16].includes(size)) return { ok: false, error: "Size must be 4, 8, or 16." };
  if (!Number.isFinite(roundDays) || roundDays < 1 || roundDays > 14) {
    return { ok: false, error: "Round length must be 1–14 days." };
  }
  if (participants.length !== size) {
    return { ok: false, error: `Pick exactly ${size} shoes (you picked ${participants.length}).` };
  }

  const subs = await prisma.submission.findMany({
    where: { id: { in: participants }, status: "APPROVED" },
  });
  if (subs.length !== size) return { ok: false, error: "All entrants must be approved submissions." };

  // Seed by current heat: better-performing shoes get the higher seeds.
  const heat = await getHeatList();
  const heatRank = new Map(heat.map((h, i) => [h.id, i]));
  const seeded = [...participants].sort(
    (a, b) => (heatRank.get(a) ?? Infinity) - (heatRank.get(b) ?? Infinity)
  );

  await createTournament({ name, prize, size, roundDays, seededSubmissionIds: seeded });

  revalidatePath("/tournaments");
  revalidatePath("/battles");
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

export async function forceAdvanceTournament(tournamentId: string) {
  await requireAdmin();
  const matches = await prisma.tournamentMatch.findMany({
    where: { tournamentId, battle: { status: "ACTIVE" } },
    select: { battleId: true },
  });
  const battleIds = matches.map((m) => m.battleId).filter((id): id is string => Boolean(id));
  if (battleIds.length > 0) {
    await prisma.battle.updateMany({
      where: { id: { in: battleIds } },
      data: { endsAt: new Date(Date.now() - 1000) },
    });
  }
  await finalizeExpiredBattles();
  revalidatePath("/tournaments");
  revalidatePath("/battles");
  revalidatePath("/admin");
}

// ---------- Giveaways ----------

export async function createGiveaway(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const prize = String(formData.get("prize") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const days = Number(formData.get("days") ?? 14);

  if (!title || !prize) return { ok: false, error: "Title and prize are required." };
  if (!Number.isFinite(days) || days < 1 || days > 90) return { ok: false, error: "Length must be 1–90 days." };

  await prisma.giveaway.create({
    data: {
      title,
      prize,
      description: description || null,
      endsAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
  });

  revalidatePath("/giveaway");
  revalidatePath("/quiz");
  revalidatePath("/admin");
  return { ok: true };
}

export async function drawGiveawayWinner(giveawayId: string) {
  await requireAdmin();
  const entries = await prisma.giveawayEntry.findMany({
    where: { giveawayId },
    select: { userId: true },
  });
  if (entries.length === 0) {
    await prisma.giveaway.update({ where: { id: giveawayId }, data: { status: "CLOSED" } });
  } else {
    const winner = entries[randomInt(entries.length)];
    await prisma.giveaway.update({
      where: { id: giveawayId },
      data: { status: "DRAWN", winnerId: winner.userId },
    });
  }
  revalidatePath("/giveaway");
  revalidatePath("/admin");
}

// ---------- Quiz questions ----------

export async function saveQuestion(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const question = String(formData.get("question") ?? "").trim();
  const options = [0, 1, 2, 3].map((i) => String(formData.get(`option${i}`) ?? "").trim());
  const answerIndex = Number(formData.get("answerIndex"));
  const difficulty = Number(formData.get("difficulty") ?? 1);
  const category = String(formData.get("category") ?? "history").trim();
  const explanation = String(formData.get("explanation") ?? "").trim();

  if (!question) return { ok: false, error: "Question text is required." };
  if (options.some((o) => !o)) return { ok: false, error: "All four options are required." };
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    return { ok: false, error: "Pick which option is correct." };
  }

  await prisma.quizQuestion.create({
    data: {
      question,
      options: JSON.stringify(options),
      answerIndex,
      difficulty: [1, 2, 3].includes(difficulty) ? difficulty : 1,
      category: category || "history",
      explanation: explanation || null,
    },
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function toggleQuestion(id: string) {
  await requireAdmin();
  const q = await prisma.quizQuestion.findUnique({ where: { id } });
  if (q) {
    await prisma.quizQuestion.update({ where: { id }, data: { active: !q.active } });
  }
  revalidatePath("/admin");
}

export async function deleteQuestion(id: string) {
  await requireAdmin();
  await prisma.quizQuestion.delete({ where: { id } });
  revalidatePath("/admin");
}

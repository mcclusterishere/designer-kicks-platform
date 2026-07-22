"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import {
  checkPassword,
  setAdminSession,
  clearAdminSession,
  isAdmin,
  adminAccountOk,
  adminLoginAvailable,
  registerLoginAttempt,
  clearLoginAttempts,
  totpEnabled,
  verifyAdminTotp,
  beginTotpEnrollment,
  pendingTotpSecret,
  activateTotp,
  disableTotp,
  adminAllowlist,
} from "@/lib/admin";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { headers } from "next/headers";
import { finalizeExpiredBattles, getHeatList } from "@/lib/battles";
import { slugify, siteUrl } from "@/lib/articles";
import {
  facebookConfigured,
  instagramConfigured,
  postToFacebookPage,
  postToInstagram,
} from "@/lib/social";
import { uniqueArtistSlug, ensureCollectorSlug } from "@/lib/artists";
import { createTournament } from "@/lib/tournaments";
import { heatScore } from "@/lib/analytics";
import { isPieceCategory, categoryLabel, PIECE_CATEGORY_KEYS } from "@/lib/categories";
import { cultureIQ } from "@/lib/iq";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID, randomInt, randomBytes } from "crypto";
import { saveUpload } from "@/lib/storage";
import { resaleSplitLabel } from "@/lib/resale";
import { sendMail } from "@/lib/mailer";
import { allowAttempt } from "@/lib/ratelimit";
import { searchPlaces, zipFromAddress, STORE_STATUSES } from "@/lib/stores";
import { refreshDropDates } from "@/lib/dropRefresh";
import { findSku, sneakerApiLive } from "@/lib/sneakerApi";
import { isEditor, currentUserRole, ensureRefCode, editorRefLink } from "@/lib/editor";
import { SELL_PLATFORMS } from "@/lib/sellPlatforms";
import { researchProfile, onboardAgentConfigured, type ProfileDraft } from "@/lib/onboardAgent";
import { geminiConfigured, geminiJson, imageParts } from "@/lib/gemini";
import { importFromKicksDB } from "@/lib/catalog";
import { notifyBattleStart } from "@/lib/battleAlerts";
import { autopostSubmission } from "@/lib/autopost";

// note: an FYI that rides along with success — e.g. "your duplicate
// claim was merged" — for forms that want to surface it.
export type ActionResult = { ok: boolean; error?: string; note?: string };

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
// 15-second clips: duration is gated in the browser (no ffprobe on the
// server) — the 40MB cap is the hard backstop, sized for ~15s of 1080p.
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
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
  const taxonomy = taxonomyFields(formData);
  const category = String(formData.get("category") ?? "sneakers");
  const size = String(formData.get("size") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const image = formData.get("image");

  if (!title || title.length > 80) return { ok: false, error: "Give your custom a name (max 80 characters)." };
  if (!artistName || artistName.length > 60) return { ok: false, error: "Artist / crew name is required." };
  if (!baseShoe) return { ok: false, error: "Tell us the base item (e.g. Air Force 1, hoodie blank)." };
  if (!isPieceCategory(category)) {
    return { ok: false, error: "Pick a category." };
  }
  if (description.length > 600) return { ok: false, error: "Description is too long (max 600 characters)." };
  if (size.length > 20) return { ok: false, error: "Size should be short — e.g. US 10.5, L, 7 3/8." };

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

  // Origin: open-market original vs commissioned-to-order. Feeds the
  // valuation engine — the two kinds of first price mean different things.
  const provenanceType =
    String(formData.get("provenanceType") ?? "ORIGINAL") === "COMMISSION" ? "COMMISSION" : "ORIGINAL";

  // Pricing at upload — the Market runs on the artists' own numbers.
  const askingRaw = String(formData.get("askingPrice") ?? "").trim();
  let askingPriceCents: number | null = null;
  if (askingRaw) {
    const dollars = Number(askingRaw);
    if (!Number.isFinite(dollars) || dollars < 1 || dollars > 100000) {
      return { ok: false, error: "Asking price should be a number between $1 and $100,000." };
    }
    askingPriceCents = Math.round(dollars * 100);
  }

  // Collab tagging: resolve the co-artist by name, slug, or IG handle.
  // Comma-separate for three-way builds. A tag that matches nobody is
  // an error, not a silent drop — credit is the whole point.
  const collabRaw = String(formData.get("collabWith") ?? "").trim();
  const collaboratorIds: string[] = [];
  if (collabRaw) {
    for (const tag of collabRaw.split(",").map((t) => t.trim()).filter(Boolean)) {
      const handle = tag.replace(/^@/, "");
      const match = await prisma.artistProfile.findFirst({
        where: {
          status: "APPROVED",
          id: { not: artist.id },
          OR: [
            { slug: handle.toLowerCase().replace(/\s+/g, "-") },
            { displayName: { equals: tag, mode: "insensitive" } },
            { instagram: { equals: handle, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (!match) {
        return {
          ok: false,
          error: `Couldn't find "${tag}" on the chart — check the spelling, or have them claim their page first.`,
        };
      }
      if (!collaboratorIds.includes(match.id)) collaboratorIds.push(match.id);
    }
  }

  // Optional 15-second clip. One per artist per day (UTC) — a scale
  // guard while video hosting is small; photos stay unlimited.
  const video = formData.get("video");
  let videoUrl: string | null = null;
  if (video instanceof File && video.size > 0) {
    const vext = VIDEO_TYPES[video.type];
    if (!vext) return { ok: false, error: "Video must be an MP4, MOV, or WebM." };
    if (video.size > MAX_VIDEO_BYTES) {
      return { ok: false, error: "Video must be under 40MB — 15 seconds is the sweet spot (it's also the limit)." };
    }
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const todaysVideos = await prisma.submission.count({
      where: { artistId: artist.id, createdAt: { gte: dayStart }, videoUrl: { not: null } },
    });
    if (todaysVideos >= 1) {
      return { ok: false, error: "One video a day per artist while we scale up hosting — this piece can still go up with photos, or save the clip for tomorrow." };
    }
    videoUrl = await saveUpload(
      Buffer.from(await video.arrayBuffer()),
      `${randomUUID()}.${vext}`,
      video.type
    );
  }

  const fileName = `${randomUUID()}.${ext}`;
  const imageUrl = await saveUpload(
    Buffer.from(await image.arrayBuffer()),
    fileName,
    image.type
  );

  const extra = await saveImageList(formData.getAll("morePhotos"), 4);
  if (!Array.isArray(extra)) return { ok: false, error: extra.error };

  await prisma.submission.create({
    data: {
      title,
      artistName: artist.displayName,
      socialHandle: artist.instagram ?? (socialHandle || null),
      email: user.email,
      baseShoe,
      ...taxonomy,
      category,
      videoUrl,
      askingPriceCents,
      provenanceType,
      size: size || null,
      description: description || null,
      imageUrl,
      extraImages: extra,
      artistId: artist.id,
      ...(collaboratorIds.length > 0
        ? { collaborators: { connect: collaboratorIds.map((id) => ({ id })) } }
        : {}),
    },
  });

  notifyAdmin(
    "New submission in the review queue",
    `"${title}" by ${artist.displayName} just hit the queue. Review it at ${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin`
  );

  revalidatePath("/admin");
  return { ok: true };
}

/** Optional shoe taxonomy from a submission form — powers the taste engine. */
function taxonomyFields(formData: FormData) {
  const clean = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 40) || null;
  return {
    brand: clean("brand"),
    silhouette: clean("silhouette"),
    baseColorway: clean("baseColorway"),
  };
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/** Validate + store a batch of gallery photos; returns urls or an error. */
async function saveImageList(
  files: FormDataEntryValue[],
  max: number
): Promise<string[] | { error: string }> {
  const urls: string[] = [];
  for (const f of files) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (urls.length >= max) break;
    if (f.size > MAX_UPLOAD_BYTES) return { error: "Each photo must be under 6MB." };
    const ext = ALLOWED_TYPES[f.type];
    if (!ext) return { error: "Photos must be JPG, PNG, or WebP." };
    urls.push(
      await saveUpload(Buffer.from(await f.arrayBuffer()), `${randomUUID()}.${ext}`, f.type)
    );
  }
  return urls;
}

/**
 * Best-effort heads-up to the site owner (ADMIN_EMAIL) so applications
 * and sales don't sit unseen until someone thinks to open /admin.
 * Never blocks or fails the calling action.
 */
function notifyAdmin(subject: string, text: string) {
  const to = process.env.ADMIN_EMAIL;
  if (!to) return;
  sendMail({ to, subject: `[Heat Chart] ${subject}`, text }).catch(() => {});
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

  notifyAdmin(
    "New artist application",
    `${displayName}${city ? ` (${city})` : ""}${instagram ? ` · @${instagram}` : ""} applied for an artist account. Approve or reject at ${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin`
  );

  // No revalidatePath at all: every affected page is force-dynamic, and
  // any revalidation would rerender /submit into its PENDING view before
  // the client confirmation card can show.
  return { ok: true };
}

export type PreloadResult = ActionResult & {
  artistSlug?: string;
  claimUrl?: string | null; // null once the artist has claimed their account
  inviteText?: string;
  emailSent?: boolean;
  alreadyClaimed?: boolean;
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
  await requireEditor(); // staging artists is the editor's paid job (admins too)
  const me = await currentUserRole();

  const artistName = String(formData.get("artistName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const instagram = String(formData.get("instagram") ?? "").trim().replace(/^@/, "");
  const city = String(formData.get("city") ?? "").trim();
  const shoeTitle = String(formData.get("shoeTitle") ?? "").trim();
  const baseShoe = String(formData.get("baseShoe") ?? "").trim();
  const plTaxonomy = taxonomyFields(formData);
  const plCategory = String(formData.get("category") ?? "sneakers");
  const plSize = String(formData.get("size") ?? "").trim();
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
        // Credit whoever staged the page (drives the $0.50/onboarding tally).
        onboardedById: me?.id ?? null,
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

  // Cover + up to 5 more = 6 photos per shoe (the intern shoots 5–6 each).
  const plExtra = await saveImageList(formData.getAll("morePhotos"), 5);
  if (!Array.isArray(plExtra)) return { ok: false, error: plExtra.error };

  await prisma.submission.create({
    data: {
      title: shoeTitle,
      artistName: artist.displayName,
      socialHandle: artist.instagram,
      email,
      baseShoe,
      ...plTaxonomy,
      category: isPieceCategory(plCategory) ? plCategory : "sneakers",
      size: plSize || null,
      description: description || null,
      imageUrl,
      extraImages: Array.isArray(plExtra) ? plExtra : [],
      status: "APPROVED",
      artistId: artist.id,
    },
  });

  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const artistUrl = `${base}/artists/${artist.slug}`;

  // Claim link, only while the account is unclaimed. Re-preloading more
  // pieces must NOT rotate the token — a claim link already sitting in
  // the artist's DMs has to keep working.
  const alreadyClaimed = Boolean(user.passwordHash);
  let claimUrl: string | null = null;
  if (!alreadyClaimed) {
    let token = (
      await prisma.passwordResetToken.findFirst({
        where: { userId: user.id, expires: { gt: new Date() } },
      })
    )?.token;
    if (!token) {
      token = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.create({
        data: { token, userId: user.id, expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      });
    }
    claimUrl = `${base}/reset-password/${token}`;
  }

  const inviteText = alreadyClaimed
    ? `Yo ${artistName} — just added "${shoeTitle}" to your page: ${artistUrl}\n\n` +
      `The culture's voting on it now — come see where it lands.`
    : `Yo ${artistName} — I put your ${shoeTitle} up in our battle league where people vote on heat head-to-head: ${artistUrl}\n\n` +
      `Free page you can claim, no cost, one of one just like the pair. This link makes it yours in 30 seconds: ${claimUrl}\n\n` +
      `Claim it and gain new fans from our page — you get a live rank, votes on every pair, and a record that follows your name. That's it, no strings.`;

  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    const { delivered } = await sendMail({
      to: email,
      subject: alreadyClaimed
        ? `${artistName} — "${shoeTitle}" just went live on The Heat Chart 🔥`
        : `${artistName} — your customs are live on The Heat Chart 🔥`,
      text: inviteText,
    });
    emailSent = delivered;
  }

  revalidatePath("/artists");
  revalidatePath(`/artists/${artist.slug}`);
  revalidatePath("/admin");
  return { ok: true, artistSlug: artist.slug, claimUrl, inviteText, emailSent, alreadyClaimed };
}

export async function setArtistStatus(id: string, status: "APPROVED" | "REJECTED") {
  await requireAdmin();
  const profile = await prisma.artistProfile.update({
    where: { id },
    data: { status },
    include: { user: { select: { email: true } } },
  });

  // Applicants shouldn't have to poll the site to learn they're in.
  if (status === "APPROVED" && profile.user?.email) {
    const site = process.env.NEXT_PUBLIC_SITE_URL || "";
    sendMail({
      to: profile.user.email,
      subject: `${profile.displayName} — you're approved on The Heat Chart 🔥`,
      text:
        `Your artist account is live.\n\n` +
        `Your league page: ${site}/artists/${profile.slug}\n` +
        `Submit your first piece: ${site}/submit\n\n` +
        `Every submission can be drafted into battles — wins climb the Heat List, and your closet tracks every sale with provenance.\n\n` +
        `— The Heat Chart`,
    }).catch(() => {});
  }

  revalidatePath("/admin");
  revalidatePath("/artists");
  revalidatePath("/submit");
}

/**
 * Records an off-platform sale of a one-of-one (no payment rails).
 * Allowed for the piece's artist, its current owner (resale), or an
 * admin. The sale sits PENDING — with a pending sticker on the piece —
 * until the buyer claims it from their own account, which is when
 * ownership actually moves. Evidence (receipt/payment screenshot)
 * earns the verified badge; without it, only an admin override can.
 */
export async function recordSale(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  const submissionId = String(formData.get("submissionId") ?? "");
  const buyerEmail = String(formData.get("buyerEmail") ?? "").trim().toLowerCase();
  const priceRaw = String(formData.get("price") ?? "").replace(/[$,\s]/g, "");
  const soldAtRaw = String(formData.get("soldAt") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const evidence = formData.get("evidence");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return { ok: false, error: "Enter the buyer's email — the sale waits for them to claim it." };
  }
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price < 1 || price > 100000) {
    return { ok: false, error: "Enter the sale price in dollars (1–100,000)." };
  }
  const soldAt = soldAtRaw ? new Date(`${soldAtRaw}T12:00:00Z`) : new Date();
  if (Number.isNaN(soldAt.getTime()) || soldAt > new Date()) {
    return { ok: false, error: "Sale date can't be in the future." };
  }
  if (note.length > 200) return { ok: false, error: "Note is too long (max 200 characters)." };

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { artist: true, sales: { where: { status: "PENDING" } } },
  });
  if (!submission) return { ok: false, error: "Piece not found." };
  if (submission.sales.length > 0) {
    return { ok: false, error: "This piece already has a sale pending the buyer's claim." };
  }

  const isArtist = session?.user?.id && submission.artist?.userId === session.user.id;
  const isCurrentOwner = session?.user?.id && submission.ownerId === session.user.id;
  const admin = await isAdmin();
  if (!isArtist && !isCurrentOwner && !admin) {
    return { ok: false, error: "Only the piece's artist or current owner can record its sale." };
  }

  const sellerId =
    session?.user?.id ?? submission.ownerId ?? submission.artist?.userId;
  if (!sellerId) return { ok: false, error: "Couldn't determine the seller account." };

  const sellerUser = await prisma.user.findUnique({ where: { id: sellerId } });
  if (sellerUser?.email.toLowerCase() === buyerEmail) {
    return { ok: false, error: "Buyer and seller can't be the same account." };
  }

  let evidenceUrl: string | null = null;
  if (evidence instanceof File && evidence.size > 0) {
    if (evidence.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Evidence file must be under 6MB." };
    const ext = ALLOWED_TYPES[evidence.type];
    if (!ext) return { ok: false, error: "Evidence must be a JPG, PNG, or WebP (screenshot the receipt)." };
    evidenceUrl = await saveUpload(
      Buffer.from(await evidence.arrayBuffer()),
      `${randomUUID()}.${ext}`,
      evidence.type
    );
  }

  await prisma.sale.create({
    data: {
      submissionId: submission.id,
      sellerId,
      buyerEmail,
      priceCents: Math.round(price * 100),
      soldAt,
      note: note || null,
      evidenceUrl,
    },
  });

  notifyAdmin(
    "Sale recorded — pending buyer claim",
    `"${submission.title}" recorded sold for $${price}${evidenceUrl ? " (evidence attached)" : " (no evidence)"}. It confirms when the buyer claims it; ledger: ${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin`
  );

  if (submission.artist) revalidatePath(`/artists/${submission.artist.slug}`);
  revalidatePath("/market");
  revalidatePath("/profile");
  return { ok: true };
}

/** Buyer confirms a pending sale from their own account → ownership moves. */
export async function claimSale(saleId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to claim your piece." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { submission: { include: { artist: true } } },
  });
  if (!sale || !user) return { ok: false, error: "Sale not found." };
  if (sale.status !== "PENDING") return { ok: false, error: "This sale was already claimed." };
  if (sale.buyerEmail !== user.email.toLowerCase()) {
    return { ok: false, error: "This sale is waiting on a different buyer account." };
  }
  if (sale.sellerId === user.id) return { ok: false, error: "You can't claim your own sale." };

  await prisma.$transaction([
    prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: "CONFIRMED",
        buyerId: user.id,
        verified: Boolean(sale.evidenceUrl),
        verifiedBy: sale.evidenceUrl ? "evidence" : null,
      },
    }),
    prisma.submission.update({
      where: { id: sale.submissionId },
      // New owner sets their own ask.
      data: { ownerId: user.id, askingPriceCents: null },
    }),
  ]);
  const collectorSlug = await ensureCollectorSlug(user.id);

  if (sale.submission.artist) revalidatePath(`/artists/${sale.submission.artist.slug}`);
  revalidatePath(`/collectors/${collectorSlug}`);
  revalidatePath("/market");
  revalidatePath("/profile");
  return { ok: true };
}

/** Admin override for the verified badge (both directions). */
export async function setSaleVerified(saleId: string, verified: boolean) {
  await requireAdmin();
  await prisma.sale.update({
    where: { id: saleId },
    data: { verified, verifiedBy: verified ? "admin" : null },
  });
  revalidatePath("/market");
  revalidatePath("/admin");
}

/** Current owner lists (or delists) their piece with an open ask. */
export async function setAskingPrice(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in first." };

  const submissionId = String(formData.get("submissionId") ?? "");
  const priceRaw = String(formData.get("price") ?? "").replace(/[$,\s]/g, "");

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      sales: {
        where: { status: "CONFIRMED", buyerId: session.user.id },
        orderBy: { soldAt: "desc" },
        take: 1,
      },
    },
  });
  if (!submission || submission.ownerId !== session.user.id) {
    return { ok: false, error: "Only the current owner can set an ask." };
  }
  // Reconsignment gate: relisting requires the acquiring sale to be
  // VERIFIED — evidence or admin review proving the pair is physically
  // in the collector's hands. Keeps ghost inventory off the board.
  if (!submission.sales[0]?.verified) {
    return {
      ok: false,
      error:
        "Relisting unlocks once your purchase is verified — add a receipt or payment evidence to the sale (or ask the admin to verify) proving the piece is in your hands.",
    };
  }

  let askingPriceCents: number | null = null;
  if (priceRaw !== "") {
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 1 || price > 100000) {
      return { ok: false, error: "Ask must be 1–100,000 dollars (leave blank to delist)." };
    }
    askingPriceCents = Math.round(price * 100);
  }

  await prisma.submission.update({ where: { id: submissionId }, data: { askingPriceCents } });

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (me?.collectorSlug) revalidatePath(`/collectors/${me.collectorSlug}`);
  revalidatePath("/market");
  return { ok: true };
}

// ---------- Fit battles (outfits) ----------

async function buildOutfit(
  name: string,
  submissionIds: string[],
  kind: "HOUSE" | "FAN",
  ownerId: string | null
): Promise<ActionResult> {
  if (!name || name.length > 60) return { ok: false, error: "Give the fit a name (max 60 characters)." };
  const unique = [...new Set(submissionIds)];
  if (unique.length !== PIECE_CATEGORY_KEYS.length) {
    return {
      ok: false,
      error: "A full outfit is three pieces — one pair of kicks, one apparel piece, one accessory.",
    };
  }
  const pieces = await prisma.submission.findMany({
    where: { id: { in: unique }, status: "APPROVED" },
  });
  if (pieces.length !== unique.length) return { ok: false, error: "One of those pieces isn't available." };
  // Outfits are the ONLY place categories mix — and a fit is a FULL
  // look: exactly one piece from each of the three lanes (kicks +
  // apparel + accessory). Every piece must be a real category (guards
  // crafted requests / legacy values), and all three lanes must be
  // covered — three unique canonical categories IS the whole set.
  if (!pieces.every((p) => isPieceCategory(p.category))) {
    return { ok: false, error: "One of those pieces has an unrecognized category." };
  }
  const fitLanes = new Set(pieces.map((p) => p.category));
  if (fitLanes.size !== PIECE_CATEGORY_KEYS.length) {
    const missing = PIECE_CATEGORY_KEYS.filter((c) => !fitLanes.has(c));
    return {
      ok: false,
      error: `A full outfit needs one from each category — you're missing ${missing.map(categoryLabel).join(" and ")}.`,
    };
  }
  if (kind === "FAN" && pieces.some((p) => p.ownerId !== ownerId)) {
    return { ok: false, error: "Fan fits are built only from pieces you own — cop them first." };
  }

  await prisma.outfit.create({
    data: {
      name,
      kind,
      ownerId,
      items: { create: unique.map((submissionId) => ({ submissionId })) },
    },
  });
  return { ok: true };
}

/** Admin curates a house fit from any approved pieces. */
export async function createHouseOutfit(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const ids = formData.getAll("pieces").map(String);
  const res = await buildOutfit(name, ids, "HOUSE", null);
  if (res.ok) revalidatePath("/admin");
  return res;
}

/** A fan assembles a fit from pieces in their own closet. */
export async function createFanOutfit(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in first." };
  if (!allowAttempt("fitbuild", session.user.id, 10, 60 * 60 * 1000)) {
    return { ok: false, error: "That's a lot of fits — try again in an hour." };
  }
  const name = String(formData.get("name") ?? "").trim();
  const ids = formData.getAll("pieces").map(String);
  // No revalidatePath: the profile shows a client success card.
  return buildOutfit(name, ids, "FAN", session.user.id);
}

/** Admin matches two fits of the same league into a battle. */
export async function createOutfitBattleAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const outfitAId = String(formData.get("outfitAId") ?? "");
  const outfitBId = String(formData.get("outfitBId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const days = Number(formData.get("days") ?? 3);
  if (!outfitAId || !outfitBId || outfitAId === outfitBId) {
    return { ok: false, error: "Pick two different fits." };
  }
  if (!Number.isFinite(days) || days < 1 || days > 14) {
    return { ok: false, error: "Battles run 1–14 days." };
  }
  const withHeat = {
    include: { items: { include: { submission: { include: { ratings: { select: { stars: true } } } } } } },
  } as const;
  const [a, b] = await Promise.all([
    prisma.outfit.findUnique({ where: { id: outfitAId }, ...withHeat }),
    prisma.outfit.findUnique({ where: { id: outfitBId }, ...withHeat }),
  ]);
  if (!a || !b) return { ok: false, error: "Fit not found." };

  // Two leagues: fan looks battle other fan looks (the Fan Fit League),
  // and the admin's curated house fits battle each other (Curator
  // Battles). They never cross — a fan's closet look isn't matched
  // against a hand-picked house fit.
  if (a.kind !== b.kind) {
    return {
      ok: false,
      error:
        a.kind === "FAN" || b.kind === "FAN"
          ? "Fan fits battle in the Fan Fit League — match two fan looks, or two house looks, never one of each."
          : "Match two fits from the same league.",
    };
  }

  // Fair fights only: a fit's overall heat is the average of its
  // pieces' Heat Scores, and battles only pair fits within 0.75 of a
  // flame. A 4.5-flame curator fit never farms a 2-flame starter fit.
  const outfitHeat = (o: typeof a) => {
    const scores = o.items.map(
      (i) => heatScore(i.submission.ratings.map((r) => r.stars))?.score ?? 3.5
    );
    return scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 3.5;
  };
  const heatA = outfitHeat(a);
  const heatB = outfitHeat(b);
  if (Math.abs(heatA - heatB) > 0.75) {
    return {
      ok: false,
      error: `Heat mismatch: "${a.name}" runs ${heatA.toFixed(1)} flames and "${b.name}" runs ${heatB.toFixed(1)} — fits only battle within 0.75 of a flame.`,
    };
  }

  // League follows the fits: FAN (Fan Fit League) or HOUSE (Curator
  // Battles). Both fits are the same kind — checked above.
  await prisma.outfitBattle.create({
    data: {
      title: title || null,
      league: a.kind,
      outfitAId,
      outfitBId,
      endsAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
  });
  revalidatePath("/outfits");
  revalidatePath("/admin");
  return { ok: true };
}

export async function castOutfitVote(battleId: string, outfitId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to vote." };
  if (!allowAttempt("vote", session.user.id, 30, 60 * 1000)) {
    return { ok: false, error: "Slow down — too many votes at once." };
  }
  const battle = await prisma.outfitBattle.findUnique({ where: { id: battleId } });
  if (!battle || battle.status !== "ACTIVE" || battle.endsAt < new Date()) {
    return { ok: false, error: "This fit battle has ended." };
  }
  if (outfitId !== battle.outfitAId && outfitId !== battle.outfitBId) {
    return { ok: false, error: "That fit isn't in this battle." };
  }
  try {
    await prisma.outfitVote.create({
      data: { battleId, outfitId, userId: session.user.id },
    });
  } catch {
    return { ok: false, error: "You already voted in this battle." };
  }
  return { ok: true };
}

// ---------- The Rate game (design ratings out of five flames) ----------

export type RateResult = ActionResult & { avg?: number; count?: number };

/**
 * One design, one score. Upsert so a fan can change their mind; the
 * response carries the community line so the deck can show "the
 * culture says 4.2" the moment they weigh in.
 */
export async function rateDesign(submissionId: string, stars: number): Promise<RateResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to rate designs." };
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { ok: false, error: "Ratings run 1 to 5." };
  }
  if (!allowAttempt("rate", session.user.id, 60, 60 * 1000)) {
    return { ok: false, error: "Whoa — let the flames cool for a second." };
  }
  const piece = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { status: true },
  });
  if (!piece || piece.status !== "APPROVED") return { ok: false, error: "That design isn't rateable." };

  await prisma.designRating.upsert({
    where: { submissionId_userId: { submissionId, userId: session.user.id } },
    update: { stars },
    create: { submissionId, userId: session.user.id, stars },
  });
  const agg = await prisma.designRating.aggregate({
    where: { submissionId },
    _avg: { stars: true },
    _count: true,
  });
  // No revalidatePath: the deck is a client-driven flow.
  return {
    ok: true,
    avg: Math.round((agg._avg.stars ?? stars) * 10) / 10,
    count: agg._count,
  };
}

/**
 * Same flames, real shoe: a Rate-game score on a catalog (retail)
 * sneaker. Shares the "rate" limiter with rateDesign so the deck has
 * one budget, and feeds the same taste engine.
 */
export async function rateCatalogShoe(shoeId: string, stars: number): Promise<RateResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to rate designs." };
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { ok: false, error: "Ratings run 1 to 5." };
  }
  if (!allowAttempt("rate", session.user.id, 60, 60 * 1000)) {
    return { ok: false, error: "Whoa — let the flames cool for a second." };
  }
  const shoe = await prisma.catalogShoe.findUnique({ where: { id: shoeId }, select: { id: true } });
  if (!shoe) return { ok: false, error: "That shoe isn't rateable." };

  await prisma.catalogRating.upsert({
    where: { shoeId_userId: { shoeId, userId: session.user.id } },
    update: { stars },
    create: { shoeId, userId: session.user.id, stars },
  });
  const agg = await prisma.catalogRating.aggregate({
    where: { shoeId },
    _avg: { stars: true },
    _count: true,
  });
  return {
    ok: true,
    avg: Math.round((agg._avg.stars ?? stars) * 10) / 10,
    count: agg._count,
  };
}

// ---------- Outreach (cold leads with unclaimed pages) ----------

export type OutreachResult = ActionResult & { emailSent?: boolean; claimUrl?: string };

/**
 * One-tap recruiting from the admin panel: point an unclaimed page at
 * the lead's real email, mint/reuse their claim link, and send the
 * pitch. Falls back to showing the link for manual DMs when Resend
 * isn't wired.
 */
export async function outreachInvite(
  _prev: OutreachResult | null,
  formData: FormData
): Promise<OutreachResult> {
  await requireEditor(); // outreach/onboarding is the editor's job too
  const artistId = String(formData.get("artistId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter the lead's real email." };
  }

  const profile = await prisma.artistProfile.findUnique({
    where: { id: artistId },
    include: { user: { select: { id: true, passwordHash: true, _count: { select: { accounts: true } } } } },
  });
  if (!profile) return { ok: false, error: "Artist not found." };
  if (profile.user.passwordHash || profile.user._count.accounts > 0) {
    return { ok: false, error: "This page is already claimed — no outreach needed." };
  }

  const target = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: profile.displayName, email },
  });
  if (target.passwordHash) {
    // The lead already has a member account — link the page to it and
    // let them claim via the banner instead of a password link.
    return { ok: false, error: "That email already has an account — have them use Claim This Page on their artist page instead." };
  }
  if (profile.userId !== target.id) {
    await prisma.artistProfile.update({ where: { id: profile.id }, data: { userId: target.id } });
    await prisma.submission.updateMany({ where: { artistId: profile.id }, data: { email } });
  }

  let token = (
    await prisma.passwordResetToken.findFirst({
      where: { userId: target.id, expires: { gt: new Date() } },
    })
  )?.token;
  if (!token) {
    token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.deleteMany({ where: { userId: target.id } });
    await prisma.passwordResetToken.create({
      data: { token, userId: target.id, expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    });
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const claimUrl = `${base}/reset-password/${token}`;
  const pageUrl = `${base}/artists/${profile.slug}`;
  const pitch =
    `Yo ${profile.displayName} — I put your work up in our battle league where people vote on heat head-to-head: ${pageUrl}\n\n` +
    `Free page you can claim, no cost, one of one just like your pairs. This link makes it yours in 30 seconds: ${claimUrl}\n\n` +
    `Claim it and gain new fans from our page — you get a live rank, votes on every pair, and a record that follows your name. That's it, no strings.\n\n` +
    `— Matt, The Heat Chart (the Designer Kicks page)`;

  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    const { delivered } = await sendMail({
      to: email,
      subject: `${profile.displayName} — your page on The Heat Chart is ready to claim 🔥`,
      text: pitch,
    });
    emailSent = delivered;
  }
  await prisma.artistProfile.update({
    where: { id: profile.id },
    data: { invitedAt: new Date(), outreachStage: "INVITED" },
  });

  revalidatePath("/admin");
  return { ok: true, emailSent, claimUrl };
}

// ---------- Artist page claims (pre-loaded roster handover) ----------

/**
 * A visitor asserts they're the artist behind an unclaimed pre-loaded
 * page. Lands PENDING in the admin's Profile Claims queue.
 */
export async function submitArtistClaim(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const artistId = String(formData.get("artistId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const socialProof = String(formData.get("socialProof") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  // Seller non-negotiables — private, admin-only, never public.
  const phone = String(formData.get("phone") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const addressLine = String(formData.get("addressLine") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const zip = String(formData.get("zip") ?? "").trim();

  if (!name || name.length > 60) return { ok: false, error: "Your name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "A valid email is required — it becomes your account." };
  if (phone.replace(/\D/g, "").length < 10) {
    return { ok: false, error: "A real phone number is required to sell on the platform." };
  }
  if (!addressLine || addressLine.length > 120) {
    return { ok: false, error: "A street mailing address is required to sell on the platform." };
  }
  if (/\b(p\.?\s*o\.?\s*box|post\s*office\s*box|pob\b)/i.test(addressLine)) {
    return { ok: false, error: "No P.O. Boxes — a street address is required (it stays private, admin-only)." };
  }
  if (!city || city.length > 60) return { ok: false, error: "City is required." };
  if (!state || state.length > 30) return { ok: false, error: "State is required." };
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { ok: false, error: "A valid ZIP code is required." };
  if (businessName.length > 80) return { ok: false, error: "Business name is too long." };
  if (!socialProof || socialProof.length > 120) {
    return { ok: false, error: "Drop your Instagram or shop link so we can verify it's you." };
  }
  if (message.length > 400) return { ok: false, error: "Message is too long (max 400 characters)." };

  if (!allowAttempt("artistclaim", await clientIp(), 5, 60 * 60 * 1000)) {
    return { ok: false, error: "Too many claim attempts — try again in an hour." };
  }

  const artist = await prisma.artistProfile.findUnique({
    where: { id: artistId },
    include: { user: { select: { passwordHash: true, _count: { select: { accounts: true } } } } },
  });
  if (!artist) return { ok: false, error: "Page not found." };
  if (artist.user.passwordHash || artist.user._count.accounts > 0) {
    return { ok: false, error: "This page has already been claimed." };
  }

  const claimData = {
    name,
    socialProof,
    message: message || null,
    phone,
    businessName: businessName || null,
    addressLine,
    city,
    state,
    zip,
  };

  // Duplicate info merges, never dead-ends: a re-file from the same
  // email refreshes the pending claim with the newest answers.
  const existing = await prisma.artistClaim.findFirst({
    where: { artistId, email, status: "PENDING" },
  });
  if (existing) {
    await prisma.artistClaim.update({ where: { id: existing.id }, data: claimData });
    return {
      ok: true,
      note: "You already had a claim pending on this page — we merged in your newest answers instead of filing a duplicate. Still in the review queue.",
    };
  }

  await prisma.artistClaim.create({ data: { artistId, email, ...claimData } });

  notifyAdmin(
    `Profile claim: ${artist.displayName}`,
    `${name} (${email}) says the ${artist.displayName} page is theirs.\nProof: ${socialProof}\nReview it at ${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin`
  );

  return { ok: true };
}

/**
 * Admin verdict on a claim. Approving relinks the page to an account
 * under the claimant's email, mints (or reuses) the password-setting
 * claim link, emails it when Resend is wired, and closes out any other
 * pending claims on the same page.
 */
export async function respondArtistClaim(claimId: string, approve: boolean): Promise<void> {
  await requireAdmin();
  const claim = await prisma.artistClaim.findUnique({
    where: { id: claimId },
    include: { artist: true },
  });
  if (!claim || claim.status !== "PENDING") return;

  if (!approve) {
    await prisma.artistClaim.update({ where: { id: claimId }, data: { status: "REJECTED" } });
    revalidatePath("/admin");
    return;
  }

  const user = await prisma.user.upsert({
    where: { email: claim.email },
    update: { name: claim.name },
    create: { name: claim.name, email: claim.email },
  });
  await prisma.$transaction([
    prisma.artistProfile.update({ where: { id: claim.artistId }, data: { userId: user.id } }),
    prisma.submission.updateMany({ where: { artistId: claim.artistId }, data: { email: claim.email } }),
    prisma.artistClaim.update({ where: { id: claimId }, data: { status: "APPROVED" } }),
    prisma.artistClaim.updateMany({
      where: { artistId: claim.artistId, status: "PENDING", id: { not: claimId } },
      data: { status: "REJECTED" },
    }),
  ]);

  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  if (user.passwordHash) {
    // They already registered an account with this email — the page
    // just attached itself to it. No password link needed; that's the
    // merge working as designed.
    sendMail({
      to: claim.email,
      subject: `${claim.artist.displayName} — your Heat Chart page is verified ✓`,
      text:
        `Your claim on the ${claim.artist.displayName} page was approved.\n\n` +
        `Good news: you already have a Heat Chart account under this email, so the page is now attached to it. Just sign in:\n${base}/signin\n\n` +
        `Your page: ${base}/artists/${claim.artist.slug}\n\nWelcome to the league.`,
    }).catch(() => {});
  } else {
    // Claim link: reuse a live token, never rotate one out from under a DM.
    let token = (
      await prisma.passwordResetToken.findFirst({
        where: { userId: user.id, expires: { gt: new Date() } },
      })
    )?.token;
    if (!token) {
      token = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.create({
        data: { token, userId: user.id, expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      });
    }
    sendMail({
      to: claim.email,
      subject: `${claim.artist.displayName} — your Heat Chart page is verified ✓`,
      text:
        `Your claim on the ${claim.artist.displayName} page was approved.\n\n` +
        `Set your password here (link valid 14 days):\n${base}/reset-password/${token}\n\n` +
        `Your page: ${base}/artists/${claim.artist.slug}\n\nWelcome to the league.`,
    }).catch(() => {});
  }

  revalidatePath("/admin");
  revalidatePath(`/artists/${claim.artist.slug}`);
}

/**
 * Add gallery photos to an existing piece — the artist from their own
 * page, or an admin (e.g. topping up a pre-loaded artist's angles).
 * Gallery is capped at 6 images total including the cover.
 */
export async function addSubmissionPhotos(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  const submissionId = String(formData.get("submissionId") ?? "");

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { artist: { select: { userId: true, slug: true } } },
  });
  if (!submission) return { ok: false, error: "Piece not found." };

  const admin = await isAdmin();
  const isArtistOwner = session?.user?.id && submission.artist?.userId === session.user.id;
  if (!admin && !isArtistOwner) {
    return { ok: false, error: "Only the piece's artist or an admin can add photos." };
  }

  const room = 6 - 1 - submission.extraImages.length;
  if (room <= 0) return { ok: false, error: "Gallery is full (6 photos max)." };

  const added = await saveImageList(formData.getAll("photos"), room);
  if (!Array.isArray(added)) return { ok: false, error: added.error };
  if (added.length === 0) return { ok: false, error: "Pick at least one photo." };

  await prisma.submission.update({
    where: { id: submissionId },
    data: { extraImages: { push: added } },
  });

  if (submission.artist) revalidatePath(`/artists/${submission.artist.slug}`);
  return { ok: true };
}

// ---------- Offers (the demand side of the index) ----------
//
// No money moves on-platform: an offer is a standing bid the seller can
// accept. Accepting creates a PENDING Sale to the buyer's email and the
// existing claim flow finishes the hand-off (buyer confirms from their
// own account, ownership transfers, the sale prices the market board).

export async function placeOffer(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to make an offer." };

  const submissionId = String(formData.get("submissionId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").replace(/[$,\s]/g, "");
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
    return { ok: false, error: "Offer must be 1–100,000 dollars." };
  }

  if (!allowAttempt("offer", session.user.id, 20, 60 * 60 * 1000)) {
    return { ok: false, error: "That's a lot of offers — try again in an hour." };
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      artist: { select: { userId: true, user: { select: { email: true } } } },
      owner: { select: { id: true, email: true } },
      sales: { where: { status: "PENDING" }, select: { id: true } },
      consignment: { select: { status: true, floorCents: true } },
    },
  });
  if (!submission || submission.status !== "APPROVED") return { ok: false, error: "Piece not found." };
  if (submission.sales.length > 0) {
    return { ok: false, error: "This piece has a sale pending — offers reopen if it falls through." };
  }
  // Consignment floor: the disclosed minimum. Below it, the bid bounces.
  if (
    submission.consignment?.status === "OPEN" &&
    Math.round(amount * 100) < submission.consignment.floorCents
  ) {
    return {
      ok: false,
      error: `Bids on this consignment start at $${Math.round(submission.consignment.floorCents / 100)}.`,
    };
  }

  // The current seller can't bid on their own piece (owner if sold on,
  // otherwise the artist) — but an artist CAN offer to buy a piece back.
  const sellerUserId = submission.owner?.id ?? submission.artist?.userId ?? null;
  if (sellerUserId === session.user.id) {
    return { ok: false, error: "This one's already yours to sell — set an ask instead." };
  }

  const existing = await prisma.offer.findFirst({
    where: { submissionId, buyerId: session.user.id, status: "OPEN" },
  });
  if (existing) {
    await prisma.offer.update({ where: { id: existing.id }, data: { amountCents: Math.round(amount * 100) } });
  } else {
    await prisma.offer.create({
      data: { submissionId, buyerId: session.user.id, amountCents: Math.round(amount * 100) },
    });
  }

  // Ping the seller — throttled per (buyer → seller) pair: one buyer
  // can't email-bomb a seller (or burn Resend quota), and because the
  // key includes the buyer, one attacker can't exhaust a shared per-
  // seller budget and starve OTHER buyers' legit offer emails.
  const sellerEmail = submission.owner?.email ?? submission.artist?.user?.email;
  const mailKey = `${sellerEmail?.toLowerCase()}:${session.user.id}`;
  if (sellerEmail && allowAttempt("offermail", mailKey, 3, 60 * 60 * 1000)) {
    sendMail({
      to: sellerEmail,
      subject: `$${amount} offer on "${submission.title}" 💸`,
      text:
        `Someone just offered $${amount} for "${submission.title}" on The Heat Chart.\n\n` +
        `Accept or decline from your profile: ${process.env.NEXT_PUBLIC_SITE_URL || ""}/profile\n\n` +
        `Accepting records the sale to the buyer — they confirm it from their account and the piece (plus its provenance) transfers on the spot.`,
    }).catch(() => {});
  }

  // No revalidatePath: /market is force-dynamic, and revalidating here
  // would unmount the form before its confirmation shows.
  return { ok: true };
}

export async function withdrawOffer(offerId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.offer.updateMany({
    where: { id: offerId, buyerId: session.user.id, status: "OPEN" },
    data: { status: "WITHDRAWN" },
  });
  revalidatePath("/profile");
}

export async function respondOffer(offerId: string, accept: boolean): Promise<void> {
  const session = await auth();
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      buyer: { select: { id: true, email: true } },
      submission: {
        include: {
          artist: { select: { userId: true, slug: true } },
          sales: { where: { status: "PENDING" }, select: { id: true } },
        },
      },
    },
  });
  if (!offer || offer.status !== "OPEN") return;

  const sellerUserId = offer.submission.ownerId ?? offer.submission.artist?.userId ?? null;
  const admin = await isAdmin();
  if (!admin && (!session?.user?.id || session.user.id !== sellerUserId)) return;

  if (!accept) {
    await prisma.offer.update({ where: { id: offerId }, data: { status: "DECLINED" } });
    revalidatePath("/profile");
    return;
  }

  // Accept: one pending sale per piece, ever.
  if (offer.submission.sales.length > 0) return;
  const sellerId = sellerUserId ?? offer.submission.artist?.userId;
  if (!sellerId || sellerId === offer.buyer.id) return;

  // A consigned piece selling closes its consignment — the sale note
  // carries the disclosure so the provenance chain reads clean.
  const consignment = await prisma.consignment.findUnique({
    where: { submissionId: offer.submissionId },
    select: { id: true, status: true, splitPct: true },
  });
  const activeConsignment = consignment?.status === "OPEN" ? consignment : null;

  await prisma.$transaction([
    prisma.sale.create({
      data: {
        submissionId: offer.submissionId,
        sellerId,
        buyerEmail: offer.buyer.email.toLowerCase(),
        priceCents: offer.amountCents,
        note: activeConsignment
          ? `Accepted platform offer — consignment relist, ${activeConsignment.splitPct}% of proceeds to the consignor`
          : offer.submission.ownerId
            ? `Accepted platform offer — collector resale under the reconsignment program (${resaleSplitLabel()})`
            : "Accepted platform offer",
      },
    }),
    prisma.offer.update({ where: { id: offerId }, data: { status: "ACCEPTED" } }),
    // Clear the field: other bidders' offers close when one is taken.
    prisma.offer.updateMany({
      where: { submissionId: offer.submissionId, status: "OPEN", id: { not: offerId } },
      data: { status: "DECLINED" },
    }),
    ...(activeConsignment
      ? [prisma.consignment.update({ where: { id: activeConsignment.id }, data: { status: "SOLD" } })]
      : []),
  ]);

  sendMail({
    to: offer.buyer.email,
    subject: `Offer accepted — claim "${offer.submission.title}" 🔥`,
    text:
      `Your $${Math.round(offer.amountCents / 100)} offer on "${offer.submission.title}" was accepted.\n\n` +
      `Settle payment with the seller however you two agree, then claim the piece from your profile to lock in ownership and provenance: ${process.env.NEXT_PUBLIC_SITE_URL || ""}/profile`,
  }).catch(() => {});

  if (offer.submission.artist) revalidatePath(`/artists/${offer.submission.artist.slug}`);
  revalidatePath("/market");
  revalidatePath("/profile");
}

/**
 * Consignment relist: a piece the artist previously sold comes back
 * and re-enters the market with its history disclosed — prior price,
 * consignor split, bid floor. The disclosure is what makes the relist
 * legitimate market data instead of an engineered price: anyone
 * reading the board (including a lender's diligence team) sees the
 * related-party relationship on the record.
 */
export async function createConsignment(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in first." };

  const submissionId = String(formData.get("submissionId") ?? "");
  const priorSaleRaw = String(formData.get("priorSale") ?? "").replace(/[$,\s]/g, "");
  const floorRaw = String(formData.get("floor") ?? "").replace(/[$,\s]/g, "");
  const splitRaw = String(formData.get("split") ?? "75").trim();
  const consignorName = String(formData.get("consignorName") ?? "").trim().slice(0, 80);

  const floor = Number(floorRaw);
  if (!Number.isFinite(floor) || floor < 1 || floor > 100000) {
    return { ok: false, error: "Set a bid floor between $1 and $100,000." };
  }
  const priorSale = priorSaleRaw ? Number(priorSaleRaw) : null;
  if (priorSale !== null && (!Number.isFinite(priorSale) || priorSale < 1 || priorSale > 100000)) {
    return { ok: false, error: "Prior sale price should be between $1 and $100,000." };
  }
  const split = Number(splitRaw);
  if (!Number.isInteger(split) || split < 0 || split > 100) {
    return { ok: false, error: "The consignor's split should be 0–100%." };
  }

  const piece = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      artist: { select: { id: true, userId: true, slug: true } },
      consignment: { select: { id: true, status: true } },
      sales: { where: { status: "PENDING" }, select: { id: true } },
      owner: { select: { id: true } },
    },
  });
  if (!piece || piece.status !== "APPROVED") return { ok: false, error: "Piece not found." };
  if (piece.artist?.userId !== session.user.id) {
    return { ok: false, error: "Only the artist can open a consignment on their piece." };
  }
  if (piece.owner) {
    return {
      ok: false,
      error:
        "This piece is in a collector's closet on-platform — they sell it from their side. Consignment relists are for pieces that came back to you from off-platform sales.",
    };
  }
  if (piece.sales.length > 0) return { ok: false, error: "This piece has a sale pending." };
  if (piece.consignment && piece.consignment.status === "OPEN") {
    return { ok: false, error: "This piece already has an open consignment." };
  }

  const data = {
    artistId: piece.artist.id,
    priorSaleCents: priorSale !== null ? Math.round(priorSale * 100) : null,
    consignorName: consignorName || null,
    splitPct: split,
    floorCents: Math.round(floor * 100),
    status: "OPEN",
  };
  if (piece.consignment) {
    await prisma.consignment.update({ where: { id: piece.consignment.id }, data });
  } else {
    await prisma.consignment.create({ data: { ...data, submissionId } });
  }
  // A floor implies an ask if none is set — the board needs a number.
  if (!piece.askingPriceCents) {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { askingPriceCents: Math.round(floor * 100) },
    });
  }

  if (piece.artist.slug) revalidatePath(`/artists/${piece.artist.slug}`);
  revalidatePath("/market");
  return { ok: true };
}

/**
 * Market order, StockX-style: the seller taps once and the piece sells
 * to the highest standing bid. Thin wrapper over respondOffer, which
 * re-verifies the caller is the seller, creates the PENDING sale,
 * marks the winning bid ACCEPTED, and closes the rest of the book.
 */
export async function acceptHighestBid(submissionId: string): Promise<ActionResult> {
  const top = await prisma.offer.findFirst({
    where: { submissionId, status: "OPEN" },
    orderBy: { amountCents: "desc" },
  });
  if (!top) return { ok: false, error: "No open bids on this piece yet." };
  await respondOffer(top.id, true);
  const sale = await prisma.sale.findFirst({
    where: { submissionId, status: "PENDING" },
    select: { id: true },
  });
  return sale
    ? { ok: true }
    : { ok: false, error: "Couldn't execute — the bid may have just been withdrawn." };
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

/** Editor Desk actions: the editor role OR an admin may pass. */
async function requireEditor() {
  if (await isAdmin()) return;
  if (!(await isEditor())) redirect("/editor");
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

  if (!(await adminAccountOk())) {
    return {
      ok: false,
      error:
        "This panel is locked to the owner's member account — sign in to the site with that account first, then enter the admin password.",
    };
  }

  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    notifyAdmin(
      "Failed admin login attempt",
      `Wrong admin password entered from IP ${ip} at ${new Date().toISOString()}. If this wasn't you, consider rotating ADMIN_PASSWORD in Railway.`
    );
    return { ok: false, error: "Wrong password." };
  }
  // Third lock: authenticator-app code, when 2FA is switched on.
  if (await totpEnabled()) {
    const code = String(formData.get("code") ?? "");
    if (!(await verifyAdminTotp(code))) {
      return { ok: false, error: "Enter the 6-digit code from your authenticator app." };
    }
  }
  clearLoginAttempts(ip); // right password — only wrong guesses count
  await setAdminSession();
  revalidatePath("/admin");
  return { ok: true };
}

// ---------- Admin two-step verification (authenticator app) ----------

export type TotpSetupResult = ActionResult & { secret?: string; uri?: string };

/**
 * Start 2FA enrollment: mint a secret, stash it as pending (not yet
 * enforced), and hand back the key + otpauth URI so the admin can add it
 * to their authenticator app. It only goes live after confirmAdminTotp.
 */
export async function startAdminTotpSetup(): Promise<TotpSetupResult> {
  await requireAdmin();
  const secret = generateTotpSecret();
  await beginTotpEnrollment(secret);
  const account = adminAllowlist()[0] ?? "admin";
  return { ok: true, secret, uri: otpauthUri(secret, account) };
}

/** Confirm the pending secret with a live code, then enforce it at login. */
export async function confirmAdminTotp(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const pending = await pendingTotpSecret();
  if (!pending) return { ok: false, error: "Start setup first, then enter a code." };
  const code = String(formData.get("code") ?? "");
  if (!verifyTotp(pending, code, Math.floor(Date.now() / 1000))) {
    return { ok: false, error: "That code didn't match — check your app's clock and try again." };
  }
  await activateTotp();
  revalidatePath("/admin");
  return { ok: true, note: "Two-step verification is on. You'll need a code next sign-in." };
}

/** Turn 2FA back off (already inside the panel, so the session vouches). */
export async function disableAdminTotp(): Promise<ActionResult> {
  await requireAdmin();
  await disableTotp();
  revalidatePath("/admin");
  return { ok: true, note: "Two-step verification is off." };
}

export async function adminLogout() {
  await clearAdminSession();
  revalidatePath("/admin");
}

export async function setSubmissionStatus(id: string, status: "APPROVED" | "REJECTED") {
  await requireAdmin();
  await prisma.submission.update({ where: { id }, data: { status } });
  // First approval turns the upload into posts — site Feed + connected
  // socials — with nobody at the keyboard. Fire-and-forget: a Meta
  // outage must never make the approve button feel broken.
  if (status === "APPROVED") {
    autopostSubmission(id).catch((e) => console.error("[autopost]", e));
  }
  revalidatePath("/admin");
  revalidatePath("/heat-list");
  revalidatePath("/");
}

/**
 * A customizer announces their own upcoming drop onto the calendar.
 * Approved artists only; it lands PENDING and shows on /drops once an
 * admin approves it (same vetting as submissions).
 */
export async function announceArtistDrop(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in first." };
  const profile = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, displayName: true },
  });
  if (!profile) return { ok: false, error: "Artist accounts only — apply for one first." };
  if (profile.status !== "APPROVED") {
    return { ok: false, error: "Your artist account is still under review." };
  }
  if (!allowAttempt("artistdrop", session.user.id, 10, 60 * 60 * 1000)) {
    return { ok: false, error: "Slow down — a few drop announcements an hour." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const buyUrl = String(formData.get("buyUrl") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const dateRaw = String(formData.get("dropAt") ?? "").trim();

  if (!title || title.length > 120) return { ok: false, error: "A drop title is required." };
  if (description.length > 600) return { ok: false, error: "Keep the description under 600 characters." };
  if (buyUrl && (buyUrl.length > 300 || !/^https?:\/\//i.test(buyUrl))) {
    return { ok: false, error: "The buy link must be a full http(s):// URL." };
  }
  if (imageUrl && (imageUrl.length > 400 || !/^(https?:\/\/|\/)/i.test(imageUrl))) {
    return { ok: false, error: "The image must be a URL." };
  }
  const dropAt = dateRaw ? new Date(`${dateRaw}T12:00:00Z`) : null;
  if (!dropAt || Number.isNaN(dropAt.getTime())) return { ok: false, error: "Pick a valid release date." };
  if (dropAt.getTime() < Date.now() - 86400000) {
    return { ok: false, error: "The release date can't be in the past." };
  }

  await prisma.artistDrop.create({
    data: {
      artistId: profile.id,
      title,
      description: description || null,
      buyUrl: buyUrl || null,
      imageUrl: imageUrl || null,
      dropAt,
    },
  });
  notifyAdmin(
    `Drop announcement: ${profile.displayName}`,
    `${profile.displayName} announced "${title}" for ${dropAt.toISOString().slice(0, 10)}. Review it at ${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin`
  );
  revalidatePath("/studio");
  return { ok: true };
}

/** Admin verdict on a customizer's announced drop. */
export async function setDropAnnouncementStatus(id: string, status: "APPROVED" | "REJECTED") {
  await requireAdmin();
  await prisma.artistDrop.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
  revalidatePath("/drops");
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
  // Category wall: hats never face shoes, vests never face hats.
  if (a.category !== b.category) {
    return {
      ok: false,
      error: `Category wall: "${a.title}" is ${categoryLabel(a.category)} and "${b.title}" is ${categoryLabel(b.category)} — pieces only battle inside their own category.`,
    };
  }

  const battle = await prisma.battle.create({
    data: {
      subAId,
      subBId,
      title: title || null,
      endsAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
  });

  // Ring the bell: every subscribed member hears a battle start.
  // Fire-and-forget — a mail hiccup never blocks the battle.
  notifyBattleStart({
    battleId: battle.id,
    aTitle: a.title,
    aArtist: a.artistName,
    bTitle: b.title,
    bArtist: b.artistName,
    endsAt: battle.endsAt,
  }).catch(() => {});

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
  await finalizeExpiredBattles(true); // explicit admin action — settle now
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
  await requireEditor(); // editors write + edit content; admins too
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  let coverImage = String(formData.get("coverImage") ?? "").trim();
  const coverFile = formData.get("cover");
  const tags = String(formData.get("tags") ?? "").trim();
  const dropAtRaw = String(formData.get("dropAt") ?? "").trim();
  const raffleUrl = String(formData.get("raffleUrl") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const publish = formData.get("publish") === "on";

  if (!title || title.length > 120) return { ok: false, error: "Title is required (max 120 characters)." };
  if (!excerpt || excerpt.length > 200) return { ok: false, error: "Excerpt is required (max 200 characters) — it's also the meta description." };
  if (!content) return { ok: false, error: "Article body is required." };
  if (raffleUrl && !/^https?:\/\//.test(raffleUrl)) {
    return { ok: false, error: "Raffle link must start with http(s)://" };
  }
  const dropAt = dropAtRaw ? new Date(`${dropAtRaw}T12:00:00Z`) : null;
  if (dropAt && Number.isNaN(dropAt.getTime())) {
    return { ok: false, error: "Drop date didn't parse — use the date picker." };
  }

  // An uploaded photo (e.g. the official press image saved to the admin's
  // device) beats the URL field — no hotlink rot, and OG previews serve
  // it from our own domain.
  if (coverFile instanceof File && coverFile.size > 0) {
    if (coverFile.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Cover photo must be under 6MB." };
    const ext = ALLOWED_TYPES[coverFile.type];
    if (!ext) return { ok: false, error: "Cover photo must be a JPG, PNG, or WebP." };
    coverImage = await saveUpload(
      Buffer.from(await coverFile.arrayBuffer()),
      `${randomUUID()}.${ext}`,
      coverFile.type
    );
  }

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
    dropAt,
    raffleUrl: raffleUrl || null,
    sku: sku || null,
    status: publish ? "PUBLISHED" : "DRAFT",
  };

  let articleId = id;
  if (id) {
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Article not found." };
    // A human touching the drop date makes it authoritative ("manual"),
    // which outranks every API source so the sync never overwrites it.
    // Leave the source alone when the date wasn't changed.
    const dateChanged = (dropAt?.getTime() ?? null) !== (existing.dropAt?.getTime() ?? null);
    const dropSource = dateChanged ? (dropAt ? "manual" : null) : existing.dropSource;
    await prisma.article.update({
      where: { id },
      data: {
        ...data,
        dropSource,
        // Stamp publishedAt on the first publish; keep the original date on edits.
        publishedAt: publish ? existing.publishedAt ?? new Date() : existing.publishedAt,
      },
    });
  } else {
    const created = await prisma.article.create({
      data: { ...data, dropSource: dropAt ? "manual" : null, publishedAt: publish ? new Date() : null },
    });
    articleId = created.id;
  }

  // The culture question that rides with the story: floats in the feed,
  // joins the infinite pool, and links readers back here to study up.
  const cqText = String(formData.get("cqQuestion") ?? "").trim();
  const cqOptions = [0, 1, 2, 3].map((i) => String(formData.get(`cqOption${i}`) ?? "").trim());
  const cqAnswer = Number(formData.get("cqAnswer"));
  if (cqText) {
    if (cqOptions.some((o) => !o)) {
      return { ok: false, error: "Culture question needs all four answer options." };
    }
    if (!Number.isInteger(cqAnswer) || cqAnswer < 0 || cqAnswer > 3) {
      return { ok: false, error: "Mark which culture-question option is correct." };
    }
    const cqExplanation = String(formData.get("cqExplanation") ?? "").trim() || null;
    const existingQ = await prisma.quizQuestion.findFirst({ where: { articleId } });
    const qData = {
      question: cqText,
      options: JSON.stringify(cqOptions),
      answerIndex: cqAnswer,
      category: "culture",
      explanation: cqExplanation,
      articleId,
      active: true,
    };
    if (existingQ) await prisma.quizQuestion.update({ where: { id: existingQ.id }, data: qData });
    else await prisma.quizQuestion.create({ data: qData });
  }

  revalidatePath("/news");
  revalidatePath(`/news/${slug}`);
  revalidatePath("/drops");
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

// ---------- Drop-date sync (SKU → release date waterfall) ----------

/**
 * Admin "Refresh dates now" — runs the sneaker-API waterfall over every
 * article carrying a style code and updates the calendar where a
 * trustworthy source moved the date. Dormant (no-op) until a provider key
 * is set. The one-line summary rides back on the ActionResult note.
 */
export async function refreshDropDatesNow(): Promise<ActionResult> {
  await requireAdmin();
  if (!sneakerApiLive()) {
    return {
      ok: false,
      error:
        "No sneaker-API key set yet. Add KICKSDB_KEY, RAPIDAPI_STOCKX_KEY, or APIFY_TOKEN in the environment to turn the sync on.",
    };
  }
  const s = await refreshDropDates({ onlyFuture: true });
  revalidatePath("/drops");
  revalidatePath("/admin");
  revalidatePath("/news");
  const bits = [`${s.checked} checked`, `${s.updated} updated`];
  if (s.notFound) bits.push(`${s.notFound} not found`);
  if (s.skippedManual) bits.push(`${s.skippedManual} manual dates kept`);
  return { ok: true, note: `Drop sync: ${bits.join(" · ")}.` };
}

/**
 * Admin "Find style code" — discovers a SKU for an article from its
 * headline via the waterfall's search, and saves it so future syncs have
 * something to key on. Dormant until a provider key is set.
 */
export async function lookupSkuForArticle(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!sneakerApiLive()) {
    return { ok: false, error: "No sneaker-API key set — can't look up style codes yet." };
  }
  const article = await prisma.article.findUnique({
    where: { id },
    select: { title: true },
  });
  if (!article) return { ok: false, error: "Article not found." };
  const hit = await findSku(article.title).catch(() => null);
  if (!hit?.sku) {
    return { ok: false, error: "No style code matched that headline. Add it by hand." };
  }
  await prisma.article.update({ where: { id }, data: { sku: hit.sku.toUpperCase() } });
  revalidatePath("/admin");
  return { ok: true, note: `Found style code ${hit.sku}${hit.name ? ` (${hit.name})` : ""}.` };
}

// ---------- Editor Desk ----------

/** Editor stages a mild-outreach prospect (with optional media upload). */
export async function stageProspect(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireEditor();
  const me = await currentUserRole();
  if (!me) return { ok: false, error: "Sign in with your editor account first." };
  if (!allowAttempt("stageprospect", me.id, 60, 60 * 60 * 1000)) {
    return { ok: false, error: "Slow down a touch — too many at once." };
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 120) return { ok: false, error: "A name/handle is required." };
  const platform = String(formData.get("platform") ?? "").trim() || null;
  const handle = String(formData.get("handle") ?? "").trim() || null;
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (notes && notes.length > 1000) return { ok: false, error: "Keep notes under 1,000 characters." };

  let fileUrl: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "File must be under 6MB." };
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) return { ok: false, error: "Upload a JPG, PNG, or WebP." };
    fileUrl = await saveUpload(Buffer.from(await file.arrayBuffer()), `${randomUUID()}.${ext}`, file.type);
  }

  await prisma.outreachProspect.create({
    data: { stagedById: me.id, name, platform, handle, contact, notes, fileUrl },
  });
  notifyAdmin("Editor staged a prospect", `${me.name || me.email} staged "${name}" for outreach review.`);
  revalidatePath("/editor");
  revalidatePath("/admin");
  return { ok: true, note: "Staged for the office to review." };
}

/** Editor sends a message — to the league office only. */
export async function sendEditorMessage(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireEditor();
  const me = await currentUserRole();
  if (!me) return { ok: false, error: "Sign in with your editor account first." };
  if (!allowAttempt("editormsg", me.id, 30, 60 * 60 * 1000)) {
    return { ok: false, error: "Too many messages — give it a minute." };
  }
  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 2000) return { ok: false, error: "Say something (2,000 characters max)." };
  await prisma.editorMessage.create({
    data: { editorId: me.id, body, fromAdmin: false, readByAdmin: false, readByEditor: true },
  });
  notifyAdmin("Message from editor", `${me.name || me.email}: ${body.slice(0, 400)}`);
  revalidatePath("/editor");
  revalidatePath("/admin");
  return { ok: true, note: "Sent to the office." };
}

// ---------- Admin: Team (editors) ----------

/** Grant editor to an email; creates the account + a claim link if new. */
export async function grantEditor(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  const name = String(formData.get("name") ?? "").trim() || null;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, name, role: "EDITOR", emailVerified: new Date() },
    });
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { role: "EDITOR", ...(name ? { name } : {}) } });
  }

  // Mint their tracked ref link so the office can see the traffic they send.
  const refCode = await ensureRefCode(user.id, name || email);

  // A set-password / claim link for accounts that can't sign in yet.
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  let claimUrl: string | null = null;
  if (!user.passwordHash) {
    let token = (
      await prisma.passwordResetToken.findFirst({ where: { userId: user.id, expires: { gt: new Date() } } })
    )?.token;
    if (!token) {
      token = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.create({
        data: { token, userId: user.id, expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      });
    }
    claimUrl = `${base}/reset-password/${token}`;
  }
  revalidatePath("/admin");
  const refLink = editorRefLink(refCode);
  return {
    ok: true,
    note: claimUrl
      ? `${email} is now an editor. Send them this set-password link: ${claimUrl} — their tracked link is ${refLink}`
      : `${email} is now an editor. They can sign in and open the Editor Desk. Their tracked link is ${refLink}`,
  };
}

export async function revokeEditor(userId: string) {
  await requireAdmin();
  await prisma.user.update({ where: { id: userId }, data: { role: "MEMBER" } });
  revalidatePath("/admin");
}

/** Admin replies to an editor; marks that editor's inbound as read. */
export async function replyToEditor(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const editorId = String(formData.get("editorId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!editorId) return { ok: false, error: "Missing editor." };
  if (!body || body.length > 2000) return { ok: false, error: "Say something (2,000 characters max)." };
  await prisma.editorMessage.create({
    data: { editorId, body, fromAdmin: true, readByAdmin: true, readByEditor: false },
  });
  await prisma.editorMessage.updateMany({
    where: { editorId, fromAdmin: false, readByAdmin: false },
    data: { readByAdmin: true },
  });
  revalidatePath("/admin");
  revalidatePath("/editor");
  return { ok: true, note: "Reply sent." };
}

export async function setProspectStatus(
  id: string,
  status: "STAGED" | "APPROVED" | "SENT" | "ARCHIVED"
) {
  await requireAdmin();
  await prisma.outreachProspect.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
}

// ---------- Careers ----------

/** Public: apply to a job posting. Rate-limited by IP. */
export async function applyToJob(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const ip = await clientIp();
  if (!allowAttempt("jobapply", ip, 8, 60 * 60 * 1000)) {
    return { ok: false, error: "Too many applications from here — try again later." };
  }
  const jobId = String(formData.get("jobId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const links = String(formData.get("links") ?? "").trim() || null;
  const pitch = String(formData.get("pitch") ?? "").trim() || null;
  if (!name || name.length > 120) return { ok: false, error: "Your name, please." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "A valid email, please." };
  if (pitch && pitch.length > 1500) return { ok: false, error: "Keep the pitch under 1,500 characters." };
  const job = await prisma.jobPosting.findFirst({ where: { id: jobId, status: "OPEN" } });
  if (!job) return { ok: false, error: "That posting just closed." };
  await prisma.jobApplication.create({ data: { jobId: job.id, name, email, links, pitch } });
  notifyAdmin("New job application", `${name} <${email}> applied for "${job.title}".${links ? ` Links: ${links}` : ""}`);
  return { ok: true, note: "Application in. We read every one — thank you." };
}

export async function setJobApplicationStatus(
  id: string,
  status: "NEW" | "REVIEWED" | "HIRED" | "PASSED"
) {
  await requireAdmin();
  await prisma.jobApplication.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
}

export async function setJobStatus(id: string, status: "OPEN" | "CLOSED") {
  await requireAdmin();
  await prisma.jobPosting.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
  revalidatePath("/careers");
}

/** Admin creates a new job posting. */
export async function saveJob(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const payLine = String(formData.get("payLine") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || "Remote";
  const body = String(formData.get("body") ?? "").trim();
  if (!title || title.length > 120) return { ok: false, error: "A job title is required." };
  if (!body) return { ok: false, error: "Describe the role in the body." };
  const slug = slugify(title);
  if (!slug) return { ok: false, error: "Couldn't derive a URL slug from that title." };
  const clash = await prisma.jobPosting.findUnique({ where: { slug } });
  if (clash) return { ok: false, error: `A posting already uses the slug "${slug}".` };
  await prisma.jobPosting.create({ data: { slug, title, payLine, location, body } });
  revalidatePath("/careers");
  revalidatePath("/admin");
  return { ok: true, note: "Posting is live on /careers." };
}

// ---------- Artist shops (where they already sell) ----------

async function myApprovedArtist() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true },
  });
}

export async function addArtistShop(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await myApprovedArtist();
  if (!profile || profile.status !== "APPROVED") {
    return { ok: false, error: "Approved artists only." };
  }
  const platform = String(formData.get("platform") ?? "").trim();
  let url = String(formData.get("url") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || null;
  if (!SELL_PLATFORMS.some((p) => p.key === platform)) {
    return { ok: false, error: "Pick a platform." };
  }
  if (!/^https?:\/\//i.test(url)) {
    if (/^[\w-]+(\.[\w-]+)+/.test(url)) url = `https://${url}`;
    else return { ok: false, error: "Enter a full link (https://…)." };
  }
  if (url.length > 400) return { ok: false, error: "That link is too long." };
  const count = await prisma.artistShop.count({ where: { artistId: profile.id } });
  if (count >= 20) return { ok: false, error: "That's plenty of shops for now." };
  await prisma.artistShop.create({ data: { artistId: profile.id, platform, url, label } });
  await prisma.artistProfile.update({ where: { id: profile.id }, data: { sellsOnline: true } });
  revalidatePath("/studio");
  return { ok: true, note: "Added to your page." };
}

export async function removeArtistShop(id: string) {
  const profile = await myApprovedArtist();
  if (!profile) return;
  const shop = await prisma.artistShop.findUnique({ where: { id }, select: { artistId: true } });
  if (!shop || shop.artistId !== profile.id) return; // ownership guard
  await prisma.artistShop.delete({ where: { id } });
  const remaining = await prisma.artistShop.count({ where: { artistId: profile.id } });
  if (remaining === 0) {
    await prisma.artistProfile.update({ where: { id: profile.id }, data: { sellsOnline: null } });
  }
  revalidatePath("/studio");
}

// ---------- Onboarding Agent (research → preloaded profile) ----------

export type ResearchResult =
  | { ok: true; draft: ProfileDraft }
  | { ok: false; dormant?: boolean; error: string };

/** Editor/admin pastes links + hints; the agent returns a profile draft. */
export async function researchProspect(
  _prev: ResearchResult | null,
  formData: FormData
): Promise<ResearchResult> {
  await requireEditor();
  if (!onboardAgentConfigured()) {
    return { ok: false, dormant: true, error: "The research agent is off — an admin adds GEMINI_API_KEY to switch it on." };
  }
  const me = await currentUserRole();
  if (me && !allowAttempt("onboardagent", me.id, 40, 60 * 60 * 1000)) {
    return { ok: false, error: "Slow down — too many lookups this hour." };
  }
  const links = String(formData.get("links") ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const hints = String(formData.get("hints") ?? "").trim();
  return researchProfile({ links, hints });
}

export type PreloadDraftResult = ActionResult & { artistUrl?: string; claimUrl?: string };

/**
 * Create a claimable, pre-loaded profile straight from the agent's draft —
 * no photo required (it's an outreach lead, pieces come when they claim).
 * Lands in the onboarding pipeline as a NEW lead.
 */
export async function createResearchedProfile(
  _prev: PreloadDraftResult | null,
  formData: FormData
): Promise<PreloadDraftResult> {
  await requireEditor();
  const me = await currentUserRole();
  const artistName = String(formData.get("artistName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const instagram = String(formData.get("instagram") ?? "").trim().replace(/^@/, "");
  const city = String(formData.get("city") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const portfolioUrl = String(formData.get("portfolioUrl") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!artistName || artistName.length > 120) return { ok: false, error: "Artist name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "A valid email is required — it becomes their claimable account." };
  }
  if (portfolioUrl && !/^https?:\/\//i.test(portfolioUrl)) {
    return { ok: false, error: "Portfolio must be a full http(s):// link." };
  }

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
        bio: bio || null,
        portfolioUrl: portfolioUrl || null,
        status: "APPROVED",
        outreachStage: "NEW",
        outreachNotes: notes || null,
        // Credit the editor who researched + staged this lead.
        onboardedById: me?.id ?? null,
      },
    });
  } else {
    artist = await prisma.artistProfile.update({
      where: { id: artist.id },
      data: {
        status: "APPROVED",
        ...(instagram ? { instagram } : {}),
        ...(city ? { city } : {}),
        ...(bio ? { bio } : {}),
        ...(portfolioUrl ? { portfolioUrl } : {}),
        ...(notes ? { outreachNotes: notes } : {}),
      },
    });
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  let claimUrl: string | undefined;
  if (!user.passwordHash) {
    let token = (
      await prisma.passwordResetToken.findFirst({ where: { userId: user.id, expires: { gt: new Date() } } })
    )?.token;
    if (!token) {
      token = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.create({
        data: { token, userId: user.id, expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      });
    }
    claimUrl = `${base}/reset-password/${token}`;
  }
  notifyAdmin("Researched profile preloaded", `${artistName} (${email}) was preloaded via the onboarding agent.`);
  revalidatePath("/editor");
  revalidatePath("/admin");
  return { ok: true, note: `Preloaded ${artistName} — now in the onboarding pipeline.`, artistUrl: `${base}/artists/${artist.slug}`, claimUrl };
}

// ---------- Shoe catalog (knowledge base for affiliate matching) ----------

export type CatalogImportResult = ActionResult & { imported?: number; updated?: number; seen?: number; priced?: number; retailPriced?: number };

/** Bulk-import real sneakers into the catalog by search query (admin). */
export async function importCatalog(
  _prev: CatalogImportResult | null,
  formData: FormData
): Promise<CatalogImportResult> {
  await requireAdmin();
  const query = String(formData.get("query") ?? "").trim().slice(0, 80);
  const pages = Math.min(10, Math.max(1, Number(formData.get("pages")) || 1));
  if (!query) return { ok: false, error: "Give it a query — a brand or model like \"Jordan\" or \"Air Force 1\"." };
  const res = await importFromKicksDB(query, pages);
  if (!res.ok) return { ok: false, error: res.error ?? "Import failed." };
  revalidatePath("/admin");
  return {
    ok: true,
    imported: res.imported,
    updated: res.updated,
    seen: res.seen,
    priced: res.priced,
    retailPriced: res.retailPriced,
    note: res.error, // partial-success warnings ride along
  };
}

// ---------- Gemini assists (all dormant until GEMINI_API_KEY) ----------

const AI_RATE = { max: 60, windowMs: 60 * 60 * 1000 }; // per-user, per hour

async function aiGate(): Promise<string | null> {
  if (!geminiConfigured()) return "The AI assist is off — an admin adds GEMINI_API_KEY to switch it on.";
  const me = await currentUserRole();
  if (me && !allowAttempt("geminiassist", me.id, AI_RATE.max, AI_RATE.windowMs)) {
    return "Slow down — too many AI calls this hour.";
  }
  return null;
}

export type ShoeDraft = {
  title: string | null;
  baseShoe: string | null;
  brand: string | null;
  silhouette: string | null;
  baseColorway: string | null;
  category: string | null;
  description: string | null;
};
export type AnalyzeResult = { ok: true; draft: ShoeDraft } | { ok: false; error: string };

/**
 * Look at the uploaded shoe photos and pre-fill the staging form: base
 * shoe, brand, silhouette, donor colorway, a title and a story line.
 * The editor reviews instead of typing — quality control, not data entry.
 */
export async function analyzeShoePhotos(formData: FormData): Promise<AnalyzeResult> {
  await requireEditor();
  const gate = await aiGate();
  if (gate) return { ok: false, error: gate };

  const files = [formData.get("image"), ...formData.getAll("morePhotos")].filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  if (files.length === 0) return { ok: false, error: "Pick the photos first, then let the AI take a look." };
  const parts = await imageParts(files);
  if (parts.length === 0) return { ok: false, error: "Those files don't look like photos it can read." };

  const out = await geminiJson<Record<string, unknown>>({
    system:
      "You identify custom sneakers from photos for a staging form. From the images, work out the donor shoe underneath the custom work. " +
      'Return ONLY JSON: {"title":string|null,"baseShoe":string|null,"brand":string|null,"silhouette":string|null,"baseColorway":string|null,"category":"sneakers"|"apparel"|"accessories","description":string|null}. ' +
      "title: a short, evocative name for THIS custom (no quotes in it). baseShoe: the donor model (e.g. Air Force 1). brand: the maker (Nike, Jordan). " +
      "silhouette: the full model name (e.g. Air Force 1 Low). baseColorway: what the donor pair was before the work, null if unknowable. " +
      "description: 1-2 sentences on the visible technique/materials. Use null anywhere you can't tell from the photos — never guess.",
    parts: [...parts, { text: "Identify this custom and fill the form fields." }],
    temperature: 0.2,
  });
  if (!out) return { ok: false, error: "Couldn't read the photos just now — try again in a moment." };
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const cat = s(out.category);
  return {
    ok: true,
    draft: {
      title: s(out.title),
      baseShoe: s(out.baseShoe),
      brand: s(out.brand),
      silhouette: s(out.silhouette),
      baseColorway: s(out.baseColorway),
      category: cat && isPieceCategory(cat) ? cat : null,
      description: s(out.description),
    },
  };
}

export type LeadCandidate = {
  name: string;
  instagram: string | null;
  link: string | null;
  city: string | null;
  why: string | null;
};
export type FindLeadsResult =
  | { ok: true; leads: LeadCandidate[]; note?: string }
  | { ok: false; error: string };

/**
 * The scout: hunt for custom-sneaker artists worth onboarding, filtered
 * against who's already on the chart. Feeds the research → stage flow.
 */
export async function findLeads(
  _prev: FindLeadsResult | null,
  formData: FormData
): Promise<FindLeadsResult> {
  await requireEditor();
  const gate = await aiGate();
  if (gate) return { ok: false, error: gate };
  const focus = String(formData.get("focus") ?? "").trim().slice(0, 200);

  const out = await geminiJson<{ candidates?: unknown[] }>({
    system:
      "You scout custom-sneaker artists (customizers who hand-paint/rework sneakers) who could join The Heat Chart, a battle-league platform. " +
      "Use search to find REAL, currently-active artists with public Instagram or portfolio pages. Prefer independent artists over big brands. " +
      'Return ONLY JSON: {"candidates":[{"name":string,"instagram":string|null,"link":string|null,"city":string|null,"why":string}]} with up to 10 candidates. ' +
      "instagram is the bare handle. link is their most useful public URL. why is one short line on what makes their work stand out. Only list artists you actually found — never invent.",
    parts: [{ text: focus ? `Scout brief from the editor: ${focus}` : "Scout brief: notable independent custom-sneaker artists active right now." }],
    search: true,
    temperature: 0.4,
  });
  if (!out?.candidates?.length) return { ok: false, error: "The scout came back empty — try a more specific brief." };

  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const raw: LeadCandidate[] = out.candidates
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        name: s(o.name) ?? "",
        instagram: s(o.instagram)?.replace(/^@/, "") ?? null,
        link: s(o.link),
        city: s(o.city),
        why: s(o.why),
      };
    })
    .filter((c) => c.name)
    .slice(0, 10);

  // Skip anyone already on the chart (by IG handle or display name).
  const existing = await prisma.artistProfile.findMany({ select: { displayName: true, instagram: true } });
  const handles = new Set(existing.map((e) => e.instagram?.toLowerCase()).filter(Boolean));
  const names = new Set(existing.map((e) => e.displayName.toLowerCase()));
  const leads = raw.filter(
    (c) => !(c.instagram && handles.has(c.instagram.toLowerCase())) && !names.has(c.name.toLowerCase())
  );
  const dropped = raw.length - leads.length;
  return {
    ok: true,
    leads,
    note: dropped > 0 ? `${dropped} already on the chart — filtered out.` : undefined,
  };
}

export type CaptionsResult =
  | { ok: true; post: string; instagram: string; x: string }
  | { ok: false; error: string };

/** Blank-box killer: draft channel-fitted captions for a cross-post. */
export async function draftCaptions(
  _prev: CaptionsResult | null,
  formData: FormData
): Promise<CaptionsResult> {
  await requireEditor();
  const gate = await aiGate();
  if (gate) return { ok: false, error: gate };
  const about = String(formData.get("about") ?? "").trim().slice(0, 400);
  if (!about) return { ok: false, error: "Say what the post is about — a link or a line is enough." };

  const out = await geminiJson<{ post?: string; instagram?: string; x?: string }>({
    system:
      "You write social captions for The Heat Chart, a custom-sneaker battle league where fans vote on artists' work. Voice: warm, culture-fluent, zero corporate filler. " +
      'Return ONLY JSON: {"post":string,"instagram":string,"x":string}. ' +
      "post: the main Feed/Facebook caption, 2-3 sentences, ends inviting people to vote/look. instagram: same energy plus 3-5 relevant hashtags on their own line. x: under 200 characters, punchy. Never invent facts not in the brief.",
    parts: [{ text: `What we're posting about:\n${about}` }],
    temperature: 0.7,
  });
  const post = out?.post?.trim();
  if (!post) return { ok: false, error: "No caption came back — try rephrasing the brief." };
  return { ok: true, post, instagram: out?.instagram?.trim() || post, x: out?.x?.trim() || post.slice(0, 200) };
}

export type QuizGenResult = { ok: true; created: number } | { ok: false; error: string };

/**
 * Draft new Culture IQ questions with search-checked facts. They land
 * INACTIVE — the owner reviews and flips each one live from the panel.
 */
export async function generateQuizQuestions(
  _prev: QuizGenResult | null,
  formData: FormData
): Promise<QuizGenResult> {
  await requireAdmin();
  if (!geminiConfigured()) return { ok: false, error: "Add GEMINI_API_KEY to switch the generator on." };
  const topic = String(formData.get("topic") ?? "").trim().slice(0, 160);
  const difficulty = Math.min(3, Math.max(1, Number(formData.get("difficulty")) || 1));

  const out = await geminiJson<{ questions?: unknown[] }>({
    system:
      "You write sneaker-culture trivia for the Culture IQ quiz. Facts must be verifiable — use search to confirm each answer. " +
      'Return ONLY JSON: {"questions":[{"question":string,"options":[string,string,string,string],"answerIndex":0|1|2|3,"explanation":string,"category":string}]} with exactly 5 questions. ' +
      "Wrong options must be plausible. explanation: one sentence teaching the fact. category: one word like history, design, culture, drops.",
    parts: [{ text: topic ? `Topic: ${topic}. Difficulty ${difficulty}/3.` : `General sneaker culture. Difficulty ${difficulty}/3.` }],
    search: true,
    temperature: 0.6,
  });
  if (!out?.questions?.length) return { ok: false, error: "Nothing usable came back — try a narrower topic." };

  let created = 0;
  for (const q of out.questions.slice(0, 8)) {
    const o = (q ?? {}) as Record<string, unknown>;
    const question = typeof o.question === "string" ? o.question.trim() : "";
    const options = Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === "string") : [];
    const answerIndex = Number(o.answerIndex);
    if (!question || options.length !== 4 || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) continue;
    const dupe = await prisma.quizQuestion.findFirst({ where: { question }, select: { id: true } });
    if (dupe) continue;
    await prisma.quizQuestion.create({
      data: {
        question,
        options: JSON.stringify(options),
        answerIndex,
        difficulty,
        category: typeof o.category === "string" && o.category.trim() ? o.category.trim().toLowerCase() : "history",
        explanation: typeof o.explanation === "string" ? o.explanation.trim() : null,
        active: false, // owner reviews, then flips live
      },
    });
    created++;
  }
  if (created === 0) return { ok: false, error: "Every draft was malformed or a duplicate — run it again." };
  revalidatePath("/admin");
  return { ok: true, created };
}

export type BriefResult = { ok: true; brief: string } | { ok: false; error: string };

/** The Monday note: last 7 days, in plain speech, from real numbers. */
export async function generateWeeklyBrief(): Promise<BriefResult> {
  await requireAdmin();
  if (!geminiConfigured()) return { ok: false, error: "Add GEMINI_API_KEY to switch the brief on." };
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [pageviews, sources, newArtists, newPieces, articlesPublished, claims] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: { gte: since } } }),
    prisma.pageView.groupBy({
      by: ["source"],
      where: { createdAt: { gte: since } },
      _count: true,
      orderBy: { _count: { source: "desc" } },
      take: 6,
    }),
    prisma.artistProfile.count({ where: { createdAt: { gte: since } } }),
    prisma.submission.count({ where: { createdAt: { gte: since } } }),
    prisma.article.count({ where: { createdAt: { gte: since }, status: "PUBLISHED" } }),
    prisma.artistClaim.count({ where: { createdAt: { gte: since } } }),
  ]);
  const facts =
    `Pageviews: ${pageviews}\n` +
    `Top sources: ${sources.map((s) => `${s.source} (${s._count})`).join(", ") || "none"}\n` +
    `New artist pages staged: ${newArtists}\nNew pieces: ${newPieces}\n` +
    `Articles published: ${articlesPublished}\nClaim requests: ${claims}`;
  const out = await geminiJson<{ brief?: string }>({
    system:
      "You write a short Monday brief for the owner of The Heat Chart. Plain speech, warm, zero fluff. " +
      "Structure: 2-3 sentences on what happened, then one 'this week, push:' line with the single highest-leverage move the numbers suggest. " +
      "Sources starting with 'ref:' are an editor's tracked link — that traffic is the intern's. " +
      'Return ONLY JSON: {"brief": string}. Under 130 words. Use only the numbers given — never invent.',
    parts: [{ text: `Last 7 days:\n${facts}` }],
    temperature: 0.5,
  });
  const brief = out?.brief?.trim();
  if (!brief) return { ok: false, error: "The brief didn't come back — try again in a moment." };
  return { ok: true, brief };
}

/** Artist says they don't sell anywhere yet → routes them to the portal. */
export async function markSellsNowhere() {
  const profile = await myApprovedArtist();
  if (!profile) return;
  await prisma.artistProfile.update({ where: { id: profile.id }, data: { sellsOnline: false } });
  revalidatePath("/studio");
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

  const division = String(formData.get("division") ?? "OPEN");
  if (!["OPEN", "RISING", "ELITE"].includes(division)) {
    return { ok: false, error: "Pick a real division." };
  }

  const subs = await prisma.submission.findMany({
    where: { id: { in: participants }, status: "APPROVED" },
    include: { ratings: { select: { stars: true } } },
  });
  if (subs.length !== size) return { ok: false, error: "All entrants must be approved submissions." };

  // Category wall: a bracket holds one category, period. The category
  // is derived from the entrants, never mixed.
  const lanes = [...new Set(subs.map((s) => s.category))];
  if (lanes.length > 1) {
    return {
      ok: false,
      error: `Category wall: this bracket mixes ${lanes.map(categoryLabel).join(" and ")} — a tournament holds one category only. Hats never face shoes.`,
    };
  }
  const category = lanes[0];

  // Seed by Heat Score (the Rate-game taste stat, smoothed) so even
  // battle-fresh pieces earn a real seed; Heat List rank breaks ties
  // and covers unrated pieces. Score never decides matches — votes do.
  const heat = await getHeatList();
  const heatRank = new Map(heat.map((h, i) => [h.id, i]));
  const scoreById = new Map(
    subs.map((s) => [s.id, heatScore(s.ratings.map((r) => r.stars))?.score ?? null])
  );
  const seeded = [...participants].sort((a, b) => {
    const sa = scoreById.get(a) ?? null;
    const sb = scoreById.get(b) ?? null;
    if (sa !== null && sb !== null && sa !== sb) return sb - sa;
    if (sa !== null && sb === null) return -1;
    if (sa === null && sb !== null) return 1;
    return (heatRank.get(a) ?? Infinity) - (heatRank.get(b) ?? Infinity);
  });

  await createTournament({ name, prize, size, roundDays, division, category, seededSubmissionIds: seeded });

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
  await finalizeExpiredBattles(true); // explicit admin "advance now" — bypass the lazy throttle
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

// ---------- Store Scout (BETA — admin-only prospecting) ----------

export type ScoutResult = ActionResult & { found?: number; added?: number; noSite?: number };

/**
 * Scan the stores around a zip through Google Places. New finds land
 * on the board as SCOUTED; rescans refresh contact facts (website,
 * rating, phone) but never touch research or pipeline status.
 */
export async function scoutStores(
  _prev: ScoutResult | null,
  formData: FormData
): Promise<ScoutResult> {
  await requireAdmin();
  const zip = String(formData.get("zip") ?? "").trim();
  const keyword = String(formData.get("keyword") ?? "").trim() || "sneaker store";
  if (!/^\d{5}$/.test(zip)) return { ok: false, error: "Enter a 5-digit US zip code." };

  let places;
  try {
    places = await searchPlaces(`${keyword} near ${zip}`);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Places search failed." };
  }

  let added = 0;
  for (const p of places) {
    const existing = await prisma.storeLead.findUnique({ where: { placeId: p.placeId } });
    if (existing) {
      await prisma.storeLead.update({
        where: { id: existing.id },
        data: {
          website: p.website,
          rating: p.rating,
          reviewCount: p.reviewCount,
          phone: existing.phone ?? p.phone,
          mapsUrl: p.mapsUrl,
        },
      });
    } else {
      await prisma.storeLead.create({
        data: { ...p, zip: zipFromAddress(p.address) ?? zip },
      });
      added++;
    }
  }
  revalidatePath("/admin");
  return {
    ok: true,
    found: places.length,
    added,
    noSite: places.filter((p) => !p.website).length,
  };
}

/** Manual add — for spots found on foot, IG, or word of mouth. */
export async function addStoreLead(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const zip = String(formData.get("zip") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  if (!name || name.length > 80) return { ok: false, error: "Store name is required." };
  if (zip && !/^\d{5}$/.test(zip)) return { ok: false, error: "Zip should be 5 digits." };

  const dup = await prisma.storeLead.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, zip: zip || undefined },
  });
  if (dup) return { ok: false, error: "That store is already on the board." };

  await prisma.storeLead.create({
    data: {
      name,
      address: address || null,
      zip: zip || null,
      phone: phone || null,
      website: website || null,
    },
  });
  revalidatePath("/admin");
  return { ok: true };
}

/** Brand research → a populated profile. A found email qualifies the lead. */
export async function updateStoreLead(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const instagram = String(formData.get("instagram") ?? "").trim().replace(/^@/, "");
  const specialty = String(formData.get("specialty") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email doesn't look right." };
  }
  const lead = await prisma.storeLead.findUnique({ where: { id } });
  if (!lead) return { ok: false, error: "Lead not found." };

  await prisma.storeLead.update({
    where: { id },
    data: {
      email: email || null,
      instagram: instagram || null,
      specialty: specialty.slice(0, 80) || null,
      notes: notes.slice(0, 1000) || null,
      // Research with a live email = ready to pitch. Never demote a
      // lead that's already been invited or joined.
      status: lead.status === "SCOUTED" && email ? "QUALIFIED" : lead.status,
    },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function setStoreStatus(id: string, status: string): Promise<void> {
  await requireAdmin();
  if (!(STORE_STATUSES as readonly string[]).includes(status)) return;
  await prisma.storeLead.update({ where: { id }, data: { status } }).catch(() => {});
  revalidatePath("/admin");
}

export type StoreInviteResult = ActionResult & { emailSent?: boolean; emailText?: string };

/** The pitch: no website? The Heat Chart becomes your storefront. */
export async function sendStoreInvite(
  _prev: StoreInviteResult | null,
  formData: FormData
): Promise<StoreInviteResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const lead = await prisma.storeLead.findUnique({ where: { id } });
  if (!lead) return { ok: false, error: "Lead not found." };
  if (!lead.email) return { ok: false, error: "Add their email in the research panel first." };

  const cred =
    lead.rating && lead.reviewCount
      ? `${lead.rating}★ across ${lead.reviewCount} Google reviews and no website listed`
      : "a real following and no website listed";
  const pitch =
    `Yo ${lead.name} team — Matt here, from The Heat Chart (formerly the Designer Kicks page).\n\n` +
    `I was mapping the best sneaker spots around ${lead.zip ?? "your area"} and your shop stood out: ${cred}. That's exactly who we built this program for.\n\n` +
    `We're hand-picking a founding class of local shops to become HEAT CHART VERIFIED STORES:\n` +
    `• A free verified storefront page — your story, your specialty, your heat, one clean link for your Google panel and IG bio\n` +
    `• Your inventory in front of a national audience that votes on sneaker heat every day\n` +
    `• Collectors place real offers through the platform — and when on-platform checkout opens, the seller fee is 1%. The big marketplaces take 10.\n` +
    `• Verified badge, priority placement in our drops calendar, and first access to the league's battles\n\n` +
    `It costs nothing — founding stores keep free access permanently. You don't need a website; that's the point. We're it.\n\n` +
    `Reply to this email${lead.instagram ? ` or DM us from @${lead.instagram}` : ""} and I'll build your storefront personally this week.\n\n` +
    `— Matt\nThe Heat Chart · theheatchart.com`;

  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    const { delivered } = await sendMail({
      to: lead.email,
      subject: `${lead.name} — Heat Chart Verified Store (free storefront, founding class)`,
      text: pitch,
    });
    emailSent = delivered;
  }
  await prisma.storeLead.update({
    where: { id },
    data: { status: "INVITED", invitedAt: new Date() },
  });
  // No revalidatePath: it would re-group the row and unmount the
  // copy-paste pitch before the admin can grab it. The board reflects
  // the new status on the next load.
  return { ok: true, emailSent, emailText: pitch };
}

// ---------- Artist outreach pipeline (recruiting tracker) ----------

/** Move a pre-loaded artist through the recruiting pipeline. */
export async function setArtistStage(artistId: string, stage: string): Promise<void> {
  await requireEditor();
  if (!["NEW", "CONTACTED", "IN_TALKS", "INVITED"].includes(stage)) return;
  await prisma.artistProfile
    .update({ where: { id: artistId }, data: { outreachStage: stage } })
    .catch(() => {});
  revalidatePath("/admin");
}

/** Save the admin's working notes on a lead ("DM'd 7/18, replied 🔥"). */
export async function saveArtistNotes(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireEditor();
  const artistId = String(formData.get("artistId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000);
  const lead = await prisma.artistProfile.findUnique({ where: { id: artistId } });
  if (!lead) return { ok: false, error: "Lead not found." };
  await prisma.artistProfile.update({
    where: { id: artistId },
    data: { outreachNotes: notes || null },
  });
  // No revalidatePath: keep the client "Saved" state mounted.
  return { ok: true };
}

// ---------- The Feed + Broadcast ----------

export type BroadcastResult =
  | {
      ok: true;
      facebook: { ok: boolean; detail: string } | null;
      instagram: { ok: boolean; detail: string } | null;
      copyText: string;
    }
  | { ok: false; error: string };

/**
 * One composer, every channel: always posts into The Feed, cross-posts
 * to the Facebook page and Instagram when their tokens are configured,
 * and hands back copy-paste text for the manual channels either way.
 */
/**
 * The broadcast pipeline the site runs as origin: it publishes to The Feed
 * (our site) and fans out to the free crosspost channels (Facebook Page +
 * Instagram) as feeders. Shared by the admin and the Editor Desk — the
 * guard lives in the thin wrappers below, not here.
 */
async function runBroadcast(formData: FormData): Promise<BroadcastResult> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 2200) {
    return { ok: false, error: "Say something (2,200 characters max — Instagram's cap)." };
  }
  const linkUrl = String(formData.get("linkUrl") ?? "").trim() || null;
  if (linkUrl && !/^(https?:\/\/|\/)/.test(linkUrl)) {
    return { ok: false, error: "Link must be a full URL or a /path on the site." };
  }
  const linkLabel = String(formData.get("linkLabel") ?? "").trim() || null;
  const pinned = formData.get("pinned") === "on";

  let imageUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Photo must be under 6MB." };
    const ext = ALLOWED_TYPES[photo.type];
    if (!ext) return { ok: false, error: "Photo must be JPG, PNG, or WebP." };
    imageUrl = await saveUpload(
      Buffer.from(await photo.arrayBuffer()),
      `${randomUUID()}.${ext}`,
      photo.type
    );
  }

  await prisma.feedPost.create({
    data: { body, imageUrl, linkUrl, linkLabel, pinned },
  });

  const shareLink = linkUrl
    ? linkUrl.startsWith("/")
      ? `${siteUrl()}${linkUrl}`
      : linkUrl
    : null;
  const [facebook, instagram] = await Promise.all([
    facebookConfigured()
      ? postToFacebookPage(body, { imageUrl, link: shareLink })
      : Promise.resolve(null),
    instagramConfigured()
      ? postToInstagram(imageUrl, shareLink ? `${body}\n\n${shareLink}` : body)
      : Promise.resolve(null),
  ]);

  revalidatePath("/");
  return {
    ok: true,
    facebook,
    instagram,
    copyText: shareLink ? `${body}\n\n${shareLink}` : body,
  };
}

export async function broadcastPost(
  _prev: BroadcastResult | null,
  formData: FormData
): Promise<BroadcastResult> {
  await requireAdmin();
  return runBroadcast(formData);
}

/** Same broadcast, from the Editor Desk (editor role or admin). */
export async function editorBroadcast(
  _prev: BroadcastResult | null,
  formData: FormData
): Promise<BroadcastResult> {
  await requireEditor();
  return runBroadcast(formData);
}

export async function deleteFeedPost(id: string) {
  // The admin (password cookie, no NextAuth session) can delete
  // anything; an artist can delete their own post.
  if (!(await isAdmin())) {
    const session = await auth();
    if (!session?.user?.id) return;
    const post = await prisma.feedPost.findUnique({
      where: { id },
      include: { artist: { select: { userId: true } } },
    });
    if (!post || post.artist?.userId !== session.user.id) return;
  }
  await prisma.feedPost.delete({ where: { id } }).catch(() => {});
  revalidatePath("/");
  revalidatePath("/admin");
}

// (Artist status posting was cut by design: the feed is kicks only —
// inventory, battles, drops, culture questions, and house broadcasts.
// Artists compete through Call Outs, not captions.)

/** Fan taps the flame on a feed post — one per fan, tap again to take it back. */
export async function toggleFeedReaction(
  postId: string
): Promise<{ ok: boolean; count: number; mine: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, count: 0, mine: false };
  const userId = session.user.id;
  if (!allowAttempt("feedreact", userId, 120, 60 * 1000)) {
    return { ok: false, count: 0, mine: false };
  }
  const existing = await prisma.feedReaction.findUnique({
    where: { postId_userId: { postId, userId } },
  });
  if (existing) {
    await prisma.feedReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.feedReaction.create({ data: { postId, userId } }).catch(() => {});
  }
  const count = await prisma.feedReaction.count({ where: { postId } });
  return { ok: true, count, mine: !existing };
}

export type FeedCommentResult =
  | { ok: true; comment: { id: string; name: string; body: string; userId: string } }
  | { ok: false; error: string };

/** Anyone signed in can talk under a post. */
export async function addFeedComment(
  postId: string,
  bodyRaw: string
): Promise<FeedCommentResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to comment." };
  const body = bodyRaw.trim().slice(0, 500);
  if (!body) return { ok: false, error: "Say something." };
  if (!allowAttempt("feedcomment", session.user.id, 20, 60 * 1000)) {
    return { ok: false, error: "Slow down a little." };
  }
  const post = await prisma.feedPost.findUnique({ where: { id: postId } });
  if (!post) return { ok: false, error: "Post is gone." };
  const comment = await prisma.feedComment.create({
    data: { postId, userId: session.user.id, body },
    include: { user: { select: { id: true, name: true } } },
  });
  return {
    ok: true,
    comment: { id: comment.id, name: comment.user.name ?? "A fan", body: comment.body, userId: comment.user.id },
  };
}

// ---------- Culture IQ: feed questions + the credit repair shop ----------

export type FeedAnswerResult =
  | { ok: true; correct: boolean; answerIndex: number; explanation: string | null; iq: number }
  | { ok: false; error: string };

/** Answer a culture question straight from the feed. One shot, forever. */
export async function answerFeedQuestion(
  questionId: string,
  choice: number
): Promise<FeedAnswerResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to play." };
  const userId = session.user.id;
  if (!allowAttempt("feedquiz", userId, 60, 60 * 1000)) {
    return { ok: false, error: "Slow down." };
  }
  const q = await prisma.quizQuestion.findUnique({ where: { id: questionId } });
  if (!q || !q.active) return { ok: false, error: "Question retired." };
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) {
    return { ok: false, error: "Pick an answer." };
  }
  const correct = choice === q.answerIndex;
  try {
    await prisma.quizAnswer.create({
      data: { userId, questionId, correct, source: "feed" },
    });
  } catch {
    return { ok: false, error: "You already took this one — no do-overs." };
  }
  const { iq } = await cultureIQ(userId);
  return { ok: true, correct, answerIndex: q.answerIndex, explanation: q.explanation, iq };
}

export type PollVoteResult =
  | { ok: true; tallies: number[]; total: number; choice: number }
  | { ok: false; error: string };

/**
 * Cast a vote in a feed community poll. One vote per fan (unique
 * pollId+userId); voting reveals the live community split. There's no
 * right answer — the responses double as taste/audience data.
 */
export async function voteInPoll(pollId: string, choice: number): Promise<PollVoteResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to vote." };
  const userId = session.user.id;
  if (!allowAttempt("pollvote", userId, 60, 60 * 1000)) {
    return { ok: false, error: "Slow down." };
  }
  const poll = await prisma.poll.findUnique({ where: { id: pollId } });
  if (!poll || !poll.active) return { ok: false, error: "Poll closed." };
  let options: string[] = [];
  try {
    options = JSON.parse(poll.options);
  } catch {}
  if (!Number.isInteger(choice) || choice < 0 || choice >= options.length) {
    return { ok: false, error: "Pick an option." };
  }
  try {
    await prisma.pollVote.create({ data: { pollId, userId, choice } });
  } catch {
    // Already voted — fall through and just return the current split.
  }
  const [rows, mine] = await Promise.all([
    prisma.pollVote.groupBy({ by: ["choice"], where: { pollId }, _count: { _all: true } }),
    prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId, userId } },
      select: { choice: true },
    }),
  ]);
  const tallies = options.map((_, i) => rows.find((r) => r.choice === i)?._count._all ?? 0);
  const total = tallies.reduce((a, b) => a + b, 0);
  return { ok: true, tallies, total, choice: mine?.choice ?? choice };
}

export type ClearMissResult =
  | { ok: true; iq: number; credits: number }
  | { ok: false; error: string };

/** 1 credit clears 1 miss. The question is burned — never asked again. */
export async function clearQuizMiss(answerId: string): Promise<ClearMissResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in first." };
  const userId = session.user.id;
  const miss = await prisma.quizAnswer.findUnique({ where: { id: answerId } });
  if (!miss || miss.userId !== userId) return { ok: false, error: "Miss not found." };
  if (miss.correct || miss.cleared) return { ok: false, error: "Nothing to clear there." };
  // Fully atomic + idempotent per answer. The cleared flip is the guard:
  // updateMany({ cleared:false }) succeeds for exactly ONE of two
  // concurrent double-clicks (count===1); the loser sees count===0 and
  // spends nothing. Only after winning the flip do we take the credit —
  // and the conditional decrement (credits>=1) still prevents a negative
  // balance. So one credit clears one miss, never two.
  const result = await prisma.$transaction(async (tx) => {
    const flip = await tx.quizAnswer.updateMany({
      where: { id: answerId, userId, correct: false, cleared: false },
      data: { cleared: true },
    });
    if (flip.count === 0) return "already"; // a concurrent clear got it first
    const dec = await tx.user.updateMany({
      where: { id: userId, credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
    if (dec.count === 0) throw new Error("no-credit"); // rolls back the flip
    await tx.creditTransaction.create({ data: { userId, delta: -1, reason: "iq-clear" } });
    return "ok";
  }).catch((e) => (e instanceof Error && e.message === "no-credit" ? "no-credit" : Promise.reject(e)));
  if (result === "no-credit") {
    return { ok: false, error: "You need a credit — grab them on the Heat Check page." };
  }
  if (result === "already") {
    return { ok: false, error: "That one's already cleared." };
  }
  const { iq } = await cultureIQ(userId);
  const fresh = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
  return { ok: true, iq, credits: fresh?.credits ?? 0 };
}

// ---------- Call Out: artist challenges from the feed ----------

export type CallOutOption = { id: string; title: string; heat: number | null };
export type CallOutOptionsResult =
  | { ok: true; options: CallOutOption[] }
  | { ok: false; error: string };

/**
 * The challenger's rack: their approved pieces sorted by how close
 * each one's Heat Score sits to the target piece — matched heat makes
 * a fair fight.
 */
export async function getCallOutOptions(
  targetSubmissionId: string
): Promise<CallOutOptionsResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in first." };
  const profile = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile || profile.status !== "APPROVED") {
    return { ok: false, error: "Only approved artists can call someone out." };
  }
  const [target, mine] = await Promise.all([
    prisma.submission.findUnique({
      where: { id: targetSubmissionId },
      include: { ratings: { select: { stars: true } } },
    }),
    prisma.submission.findMany({
      where: { artistId: profile.id, status: "APPROVED" },
      include: { ratings: { select: { stars: true } } },
    }),
  ]);
  if (!target || target.status !== "APPROVED") return { ok: false, error: "Piece not found." };
  if (target.artistId === profile.id) {
    return { ok: false, error: "That's your own piece." };
  }
  // Category wall: you answer kicks with kicks, hats with hats.
  const sameLane = mine.filter((s) => s.category === target.category);
  if (sameLane.length === 0) {
    return {
      ok: false,
      error: `Call-outs stay in-category — you need an approved ${categoryLabel(target.category)} piece in your closet to answer this one.`,
    };
  }
  const targetHeat = heatScore(target.ratings.map((r) => r.stars))?.score ?? 3.5;
  const options = sameLane
    .map((s) => ({
      id: s.id,
      title: s.title,
      heat: heatScore(s.ratings.map((r) => r.stars))?.score ?? null,
    }))
    .sort(
      (a, b) =>
        Math.abs((a.heat ?? 3.5) - targetHeat) - Math.abs((b.heat ?? 3.5) - targetHeat)
    )
    .slice(0, 8);
  if (options.length === 0) {
    return { ok: false, error: "You need an approved piece in your closet first." };
  }
  return { ok: true, options };
}

export type CallOutResult =
  | { ok: true; battleId: string }
  | { ok: false; error: string };

/** Throw the challenge: target vs your pick, live vote battle, 3 days. */
export async function throwCallOut(
  targetSubmissionId: string,
  mySubmissionId: string
): Promise<CallOutResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in first." };
  const profile = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile || profile.status !== "APPROVED") {
    return { ok: false, error: "Only approved artists can call someone out." };
  }
  if (!allowAttempt("callout", session.user.id, 3, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "Three call-outs a day keeps it sporting." };
  }
  const [target, mine] = await Promise.all([
    prisma.submission.findUnique({ where: { id: targetSubmissionId } }),
    prisma.submission.findUnique({ where: { id: mySubmissionId } }),
  ]);
  if (!target || target.status !== "APPROVED") return { ok: false, error: "Target piece not found." };
  if (!mine || mine.status !== "APPROVED" || mine.artistId !== profile.id) {
    return { ok: false, error: "Pick one of your own approved pieces." };
  }
  if (target.artistId === profile.id) return { ok: false, error: "Can't battle yourself." };
  if (target.category !== mine.category) {
    return {
      ok: false,
      error: `Category wall: that's a ${categoryLabel(target.category)} piece — answer it with your own ${categoryLabel(target.category)}, not ${categoryLabel(mine.category)}.`,
    };
  }
  const existing = await prisma.battle.findFirst({
    where: {
      status: "ACTIVE",
      OR: [
        { subAId: target.id, subBId: mine.id },
        { subAId: mine.id, subBId: target.id },
      ],
    },
  });
  if (existing) return { ok: false, error: "These two are already battling — go vote." };

  const battle = await prisma.battle.create({
    data: {
      title: "Called Out",
      subAId: target.id,
      subBId: mine.id,
      endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  });
  revalidatePath("/");
  revalidatePath("/battles");
  return { ok: true, battleId: battle.id };
}

// ---------- Outreach DM scripts + Group Scout ----------

export type DmScriptResult = { ok: true; script: string } | { ok: false; error: string };

/**
 * Gemini pass over a template DM: keep every link byte-for-byte, sound
 * like a person who actually looked at their work. Falls back to the
 * template on any doubt — a DM must never lose its claim link.
 */
async function personalizeDm(
  template: string,
  facts: { displayName: string; bio: string | null; city: string | null; instagram: string | null },
  mustKeep: string[]
): Promise<string> {
  if (!geminiConfigured()) return template;
  const out = await geminiJson<{ dm?: string }>({
    system:
      "You polish outreach DMs for The Heat Chart, a custom-sneaker battle league. Rewrite the draft so it feels personal to THIS artist — reference their specialty/city naturally if known. " +
      "Rules: keep EVERY URL from the draft exactly as written; same warm, no-strings tone; no hashtags; at most one emoji; under 90 words. " +
      'Return ONLY JSON: {"dm": string}.',
    parts: [
      {
        text:
          `Artist: ${facts.displayName}\n` +
          (facts.city ? `City: ${facts.city}\n` : "") +
          (facts.instagram ? `Instagram: @${facts.instagram}\n` : "") +
          (facts.bio ? `Bio: ${facts.bio}\n` : "") +
          `\nDraft DM to improve:\n${template}`,
      },
    ],
    temperature: 0.6,
  });
  const dm = out?.dm?.trim();
  if (!dm || !mustKeep.every((u) => dm.includes(u))) return template;
  return dm;
}

/**
 * A personalized, paste-ready DM for a pre-loaded artist — the no-email
 * path while Resend waits. Reuses any live claim link so a link already
 * sitting in someone's DMs never dies.
 */
export async function outreachDmScript(artistId: string): Promise<DmScriptResult> {
  await requireEditor();
  const profile = await prisma.artistProfile.findUnique({
    where: { id: artistId },
    include: {
      user: {
        select: { id: true, passwordHash: true, _count: { select: { accounts: true } } },
      },
      submissions: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        select: { title: true },
        take: 2,
      },
    },
  });
  if (!profile) return { ok: false, error: "Profile not found." };
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const pageUrl = `${base}/artists/${profile.slug}`;
  const claimed = Boolean(profile.user.passwordHash) || profile.user._count.accounts > 0;

  if (claimed) {
    const template =
      `Yo ${profile.displayName} — your page is yours and the culture's already voting on your work: ${pageUrl}\n\n` +
      `Next move: drop more photos from your Studio and watch your rank climb. Fans see your pairs head-to-head every day — every vote builds your record.`;
    return { ok: true, script: await personalizeDm(template, profile, [pageUrl]) };
  }

  let token = (
    await prisma.passwordResetToken.findFirst({
      where: { userId: profile.user.id, expires: { gt: new Date() } },
    })
  )?.token;
  if (!token) {
    token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.deleteMany({ where: { userId: profile.user.id } });
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: profile.user.id,
        expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
  }
  const claimUrl = `${base}/reset-password/${token}`;
  const pieces = profile.submissions.map((s) => `your ${s.title}`).join(" and ");
  const template =
    `Yo ${profile.displayName} — I put ${pieces || "your work"} up in our battle league where people vote on heat head-to-head: ${pageUrl}\n\n` +
    `Free page you can claim, no cost, one of one just like the pair. This link makes it yours in 30 seconds: ${claimUrl}\n\n` +
    `Claim it and gain new fans from our page — you get a live rank, votes on every pair, and a record that follows your name. That's it, no strings.`;
  return { ok: true, script: await personalizeDm(template, profile, [pageUrl, claimUrl]) };
}

// Group Scout: hand-tracked Facebook groups, no automation, each with
// a tagged link so the traffic tells you which group converts.

export async function addGroupLead(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim() || null;
  const adminName = String(formData.get("adminName") ?? "").trim() || null;
  const members = String(formData.get("members") ?? "").trim() || null;
  if (!name || name.length > 80) return { ok: false, error: "Group name is required." };
  if (url && !/^https?:\/\//.test(url)) return { ok: false, error: "Group link must start with http(s)://" };

  const baseSlug = slugify(name) || "group";
  let campaign = baseSlug;
  for (let i = 2; ; i++) {
    const clash = await prisma.groupLead.findUnique({ where: { campaign } });
    if (!clash) break;
    campaign = `${baseSlug}-${i}`;
  }
  await prisma.groupLead.create({ data: { name, url, adminName, members, campaign } });
  revalidatePath("/admin");
  return { ok: true };
}

export async function setGroupStage(id: string, stage: string) {
  await requireAdmin();
  if (!["NEW", "CONTACTED", "IN_TALKS", "POSTED"].includes(stage)) return;
  await prisma.groupLead.update({ where: { id }, data: { stage } }).catch(() => {});
  revalidatePath("/admin");
}

/** Working notes on a group — no revalidate, keeps the input mounted. */
export async function saveGroupNotes(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("groupId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);
  const lead = await prisma.groupLead.findUnique({ where: { id } });
  if (!lead) return { ok: false, error: "Group not found." };
  await prisma.groupLead.update({ where: { id }, data: { notes: notes || null } });
  return { ok: true };
}

export async function deleteGroupLead(id: string) {
  await requireAdmin();
  await prisma.groupLead.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin");
}

// ---------- Commission requests (the marketplace, repurposed for customizing) ----------

/**
 * A fan proposes a build: base pair + budget + the idea. The artist
 * accepts or passes from the Studio. On accept, both sides get mail —
 * the fan buys the base (eBay link included when the affiliate rail is
 * up) and ships it to the artist; addresses trade over email, never on
 * the public site.
 */
export async function submitCommissionRequest(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to commission a custom." };

  const artistId = String(formData.get("artistId") ?? "");
  const baseName = String(formData.get("baseName") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const budgetRaw = String(formData.get("budget") ?? "").replace(/[$,\s]/g, "");

  if (!baseName || baseName.length > 120) {
    return { ok: false, error: "Name the base pair (e.g. Air Force 1 Triple White, size 10)." };
  }
  if (note.length > 500) return { ok: false, error: "Keep the idea under 500 characters." };
  let budgetCents: number | null = null;
  if (budgetRaw) {
    const budget = Number(budgetRaw);
    if (!Number.isFinite(budget) || budget < 1 || budget > 100000) {
      return { ok: false, error: "Budget should be 1-100,000 dollars." };
    }
    budgetCents = Math.round(budget * 100);
  }
  if (!allowAttempt("commission", session.user.id, 10, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "That's a lot of commission requests for one day - try tomorrow." };
  }

  const artist = await prisma.artistProfile.findUnique({
    where: { id: artistId },
    select: { id: true, status: true, userId: true, displayName: true, user: { select: { email: true } } },
  });
  if (!artist || artist.status !== "APPROVED") return { ok: false, error: "Artist not found." };
  if (artist.userId === session.user.id) {
    return { ok: false, error: "That's your own page - fans commission YOU here." };
  }

  await prisma.commissionRequest.create({
    data: { userId: session.user.id, artistId: artist.id, baseName, budgetCents, note: note || null },
  });

  if (artist.user?.email) {
    sendMail({
      to: artist.user.email,
      subject: `Commission request: ${baseName} 🎨`,
      text:
        `A fan wants you to build on a ${baseName}` +
        (budgetCents ? ` with a $${Math.round(budgetCents / 100)} budget` : "") +
        `.\n\n${note ? `Their idea: ${note}\n\n` : ""}` +
        `Accept or pass from your Studio: ${process.env.NEXT_PUBLIC_SITE_URL || ""}/studio`,
    }).catch(() => {});
  }
  return { ok: true };
}

export async function respondCommissionRequest(id: string, accept: boolean): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  const request = await prisma.commissionRequest.findUnique({
    where: { id },
    include: {
      artist: { select: { userId: true, displayName: true } },
      user: { select: { email: true } },
    },
  });
  if (!request || request.status !== "PENDING") return;
  if (request.artist.userId !== session.user.id) return;

  await prisma.commissionRequest.update({
    where: { id },
    data: { status: accept ? "ACCEPTED" : "DECLINED" },
  });

  if (accept && request.user.email) {
    const ebaySearch = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(request.baseName)}`;
    sendMail({
      to: request.user.email,
      subject: `${request.artist.displayName} accepted your commission 🔥`,
      text:
        `${request.artist.displayName} is in on your ${request.baseName} build.\n\n` +
        `Next steps:\n` +
        `1. Get the base pair - grab it on eBay: ${ebaySearch}\n` +
        `2. The artist will email you from this thread to trade shipping details (never posted publicly).\n` +
        `3. When the piece is done it goes up on your artist's page - and into your closet on the chart.\n\n` +
        `Price and payment settle between you two directly.`,
    }).catch(() => {});
  }
  revalidatePath("/studio");
}

// ---------- Independent appraiser network ----------

/**
 * Intake for independent appraisers joining the network. Public form
 * (appraisers aren't members yet), rate-limited by IP. Independence is
 * the product: they never become platform employees, and the platform
 * never touches their conclusions - it feeds them data and clients.
 */
export async function applyAppraiser(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const org = String(formData.get("org") ?? "").trim();
  const specialty = String(formData.get("specialty") ?? "").trim();
  const links = String(formData.get("links") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!name || name.length > 80) return { ok: false, error: "Your name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  if (org.length > 120 || specialty.length > 160 || links.length > 300 || note.length > 600) {
    return { ok: false, error: "One of the fields is too long." };
  }

  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!allowAttempt("appraiser-apply", ip, 5, 60 * 60 * 1000)) {
    return { ok: false, error: "Too many applications from this connection - try again in an hour." };
  }

  await prisma.appraiserApplication.create({
    data: {
      name,
      email,
      org: org || null,
      specialty: specialty || null,
      links: links || null,
      note: note || null,
    },
  });

  notifyAdmin(
    "Appraiser network application",
    `${name} <${email}>\nCredentials: ${org || "-"}\nSpecialty: ${specialty || "-"}\nLinks: ${links || "-"}\n\n${note || ""}`
  );
  return { ok: true };
}

// ---------- Ambassador program (models -> curators) ----------

/**
 * Models apply to the ambassador class. The door is the Culture IQ -
 * fashion knowledge is the prerequisite, and the quiz is the proof.
 * Applying below the bar returns them to the quiz instead of a form.
 * The ladder after approval: AMBASSADOR (booked for shoots) -> CURATOR
 * (superuser - first pick of shoots, drops, events).
 */
export async function applyAmbassador(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Create an account first - the program runs through the app." };

  const igHandle = String(formData.get("igHandle") ?? "").trim().replace(/^@/, "");
  const city = String(formData.get("city") ?? "").trim();
  const links = String(formData.get("links") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!igHandle || igHandle.length > 40) return { ok: false, error: "Your Instagram handle is required." };
  if (!city || city.length > 60) return { ok: false, error: "Your city is required - shoots are booked by city." };
  if (links.length > 300 || note.length > 600) return { ok: false, error: "One of the fields is too long." };

  const { cultureIQ } = await import("@/lib/iq");
  const { AMBASSADOR_MIN_IQ } = await import("@/lib/iq");
  const { iq } = await cultureIQ(session.user.id);
  if (iq < AMBASSADOR_MIN_IQ) {
    return {
      ok: false,
      error: `The culture check is the door: you're at ${iq} IQ and the bar is ${AMBASSADOR_MIN_IQ}. Run the Heat Check quiz - every right answer is +2.`,
    };
  }

  const existing = await prisma.ambassadorApplication.findUnique({
    where: { userId: session.user.id },
  });
  if (existing) {
    await prisma.ambassadorApplication.update({
      where: { id: existing.id },
      data: { igHandle, city, links: links || null, note: note || null, iqAtApply: iq },
    });
  } else {
    await prisma.ambassadorApplication.create({
      data: {
        userId: session.user.id,
        igHandle,
        city,
        links: links || null,
        note: note || null,
        iqAtApply: iq,
      },
    });
  }

  notifyAdmin(
    "Ambassador application",
    `${session.user.name ?? "A member"} - @${igHandle} - ${city} - IQ ${iq}\nLinks: ${links || "-"}\n\n${note || ""}`
  );
  return { ok: true };
}

export async function setAmbassadorStatus(id: string, status: string): Promise<void> {
  if (!(await isAdmin())) return;
  if (!["NEW", "AMBASSADOR", "CURATOR", "PASSED"].includes(status)) return;
  await prisma.ambassadorApplication.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
}

// ---------- App-store safety rails (Apple 1.2 + 5.1.1) ----------

/**
 * Flag a piece of member content for the moderation queue. One flag
 * per member per target; every flag emails the admin so the 24-hour
 * response promise in the terms is real.
 */
export async function reportContent(
  kind: "feed_post" | "feed_comment" | "submission" | "artist",
  targetId: string,
  reason?: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to report content." };
  if (!allowAttempt("report", session.user.id, 10, 60 * 1000)) {
    return { ok: false, error: "Slow down — try again in a minute." };
  }
  const cleanReason = (reason ?? "").slice(0, 500) || null;
  await prisma.contentFlag.upsert({
    where: { kind_targetId_reporterId: { kind, targetId, reporterId: session.user.id } },
    create: { kind, targetId, reporterId: session.user.id, reason: cleanReason },
    update: { reason: cleanReason, status: "OPEN" },
  });
  notifyAdmin(
    `Content reported: ${kind} ${targetId}`,
    `A member flagged ${kind} ${targetId}.\nReason: ${cleanReason ?? "(none given)"}\nReporter: ${session.user.id}\n\nReview it in the admin panel and resolve within 24 hours.`
  );
  return { ok: true };
}

/** Block a member: their posts and comments disappear from your feed. */
export async function blockMember(blockedUserId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to block members." };
  if (blockedUserId === session.user.id) return { ok: false, error: "That's you." };
  const exists = await prisma.user.findUnique({ where: { id: blockedUserId }, select: { id: true } });
  if (!exists) return { ok: false, error: "Member not found." };
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: blockedUserId } },
    create: { blockerId: session.user.id, blockedId: blockedUserId },
    update: {},
  });
  revalidatePath("/feed");
  return { ok: true };
}

/**
 * Self-serve account deletion (App Store 5.1.1(v)). Wipes the
 * member's personal data and kills every way into the account:
 * password, OAuth links, sessions. Votes and battle results stay as
 * anonymous league records; comments show "Deleted Member".
 */
export async function deleteMyAccount(confirm: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in first." };
  if (confirm !== "DELETE") {
    return { ok: false, error: 'Type DELETE (all caps) to confirm.' };
  }
  const userId = session.user.id;
  await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Deleted Member",
        email: `deleted-${userId}@deleted.theheatchart.com`,
        emailVerified: null,
        image: null,
        passwordHash: null,
        phone: null,
        city: null,
        shoeSize: null,
        favoriteSilhouette: null,
        favoriteBrands: null,
        styleInterests: null,
        instagram: null,
        marketingOptIn: false,
        battleAlerts: false,
        shopFor: null,
        signupSource: null,
      },
    }),
  ]);
  notifyAdmin(
    "Member deleted their account",
    `User ${userId} self-deleted from the profile page. PII wiped, sign-in disabled.`
  );
  return { ok: true };
}

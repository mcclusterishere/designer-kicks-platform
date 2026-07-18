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
  const category = String(formData.get("category") ?? "sneakers");
  const size = String(formData.get("size") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const image = formData.get("image");

  if (!title || title.length > 80) return { ok: false, error: "Give your custom a name (max 80 characters)." };
  if (!artistName || artistName.length > 60) return { ok: false, error: "Artist / crew name is required." };
  if (!baseShoe) return { ok: false, error: "Tell us the base item (e.g. Air Force 1, hoodie blank)." };
  if (!["sneakers", "apparel", "accessories"].includes(category)) {
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
      category,
      size: size || null,
      description: description || null,
      imageUrl,
      artistId: artist.id,
    },
  });

  notifyAdmin(
    "New submission in the review queue",
    `"${title}" by ${artist.displayName} just hit the queue. Review it at ${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin`
  );

  revalidatePath("/admin");
  return { ok: true };
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
  await requireAdmin();

  const artistName = String(formData.get("artistName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const instagram = String(formData.get("instagram") ?? "").trim().replace(/^@/, "");
  const city = String(formData.get("city") ?? "").trim();
  const shoeTitle = String(formData.get("shoeTitle") ?? "").trim();
  const baseShoe = String(formData.get("baseShoe") ?? "").trim();
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
      category: ["sneakers", "apparel", "accessories"].includes(plCategory) ? plCategory : "sneakers",
      size: plSize || null,
      description: description || null,
      imageUrl,
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
    ? `Yo ${artistName} — just added "${shoeTitle}" to your page on The Heat Chart 🔥\n\n` +
      `${artistUrl}\n\n` +
      `The culture's voting — come see where it lands.`
    : `Yo ${artistName} — your customs are officially in the arena on The Heat Chart 🔥\n\n` +
      `The culture votes on head-to-head custom battles, and "${shoeTitle}" is already live on your artist page:\n${artistUrl}\n\n` +
      `Claim your account here (sets your password, takes 30 seconds):\n${claimUrl}\n\n` +
      `Every battle builds your W–L record on the league table, fans can follow you, and when you sell a pair you can transfer it to the buyer's collector closet. Come defend your heat.`;

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

  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission || submission.ownerId !== session.user.id) {
    return { ok: false, error: "Only the current owner can set an ask." };
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
    },
  });
  if (!submission || submission.status !== "APPROVED") return { ok: false, error: "Piece not found." };
  if (submission.sales.length > 0) {
    return { ok: false, error: "This piece has a sale pending — offers reopen if it falls through." };
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

  // Ping the seller — offers nobody sees are offers nobody accepts.
  const sellerEmail = submission.owner?.email ?? submission.artist?.user?.email;
  if (sellerEmail) {
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

  await prisma.$transaction([
    prisma.sale.create({
      data: {
        submissionId: offer.submissionId,
        sellerId,
        buyerEmail: offer.buyer.email.toLowerCase(),
        priceCents: offer.amountCents,
        note: "Accepted platform offer",
      },
    }),
    prisma.offer.update({ where: { id: offerId }, data: { status: "ACCEPTED" } }),
    // Clear the field: other bidders' offers close when one is taken.
    prisma.offer.updateMany({
      where: { submissionId: offer.submissionId, status: "OPEN", id: { not: offerId } },
      data: { status: "DECLINED" },
    }),
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
  let coverImage = String(formData.get("coverImage") ?? "").trim();
  const coverFile = formData.get("cover");
  const tags = String(formData.get("tags") ?? "").trim();
  const dropAtRaw = String(formData.get("dropAt") ?? "").trim();
  const raffleUrl = String(formData.get("raffleUrl") ?? "").trim();
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

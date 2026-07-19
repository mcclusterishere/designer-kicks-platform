"use server";

import { prisma } from "@/lib/db";
import { auth, signIn, signOut } from "@/auth";
import { sendMail } from "@/lib/mailer";
import { allowAttempt } from "@/lib/ratelimit";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import type { ActionResult } from "./actions";

const HOUR = 60 * 60 * 1000;

async function clientIp(): Promise<string> {
  const hdrs = await headers();
  return (hdrs.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

function validPassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 100) return "Password is too long.";
  return null;
}

export async function registerUser(
  _prev: (ActionResult & { devResetLink?: string }) | null,
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || name.length > 60) return { ok: false, error: "Name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  const pwErr = validPassword(password);
  if (pwErr) return { ok: false, error: pwErr };

  if (!allowAttempt("register", await clientIp(), 10, HOUR)) {
    return { ok: false, error: "Too many sign-ups from this connection — try again later." };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    include: {
      _count: { select: { accounts: true } },
      artistProfile: { select: { displayName: true, slug: true } },
    },
  });

  if (existing && (existing.passwordHash || existing._count.accounts > 0)) {
    return { ok: false, error: "An account with that email already exists — try signing in." };
  }

  if (existing) {
    // Duplicate info merges, never dead-ends — but only through the
    // verified door. A passwordless shell account exists for every
    // pre-loaded artist page; registering with its email ADOPTS it
    // (profile, pieces, record) ONLY if the league already approved a
    // claim from this exact email. Without that, knowing an artist's
    // email must never be enough to take their page.
    const verified = await prisma.artistClaim.findFirst({
      where: { email, status: "APPROVED" },
    });
    if (!verified && existing.artistProfile) {
      return {
        ok: false,
        error: `This email is attached to the ${existing.artistProfile.displayName} page, which hasn't been claimed yet. Head to that page and hit "Claim This Page" — the league verifies every claim by hand, then this email unlocks the account.`,
      };
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { name, passwordHash: await hash(password, 10) },
    });
  } else {
    await prisma.user.create({
      data: { name, email, passwordHash: await hash(password, 10) },
    });
  }

  // Sign them straight in after registration.
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch {
    // Account was created; worst case they sign in manually.
  }

  if (existing?.artistProfile) {
    return {
      ok: true,
      note: `This email already had the ${existing.artistProfile.displayName} artist page attached — it's yours now, no separate claim needed.`,
    };
  }

  // If a claim from this email is still in the review queue, say so —
  // the account hooks up automatically the moment it's approved.
  const pendingClaim = await prisma.artistClaim.findFirst({
    where: { email, status: "PENDING" },
    include: { artist: { select: { displayName: true } } },
  });
  if (pendingClaim) {
    return {
      ok: true,
      note: `Heads up: your claim on the ${pendingClaim.artist.displayName} page is still in review. When it's approved, that page attaches to this account automatically — nothing else to do.`,
    };
  }

  return { ok: true };
}

export async function loginUser(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { ok: false, error: "Email and password are required." };

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "Wrong email or password." };
    throw e;
  }
  return { ok: true };
}

export async function logoutUser() {
  await signOut({ redirect: false });
  revalidatePath("/", "layout");
}

export async function requestPasswordReset(
  _prev: (ActionResult & { devResetLink?: string }) | null,
  formData: FormData
): Promise<ActionResult & { devResetLink?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email." };

  if (!allowAttempt("pwreset", await clientIp(), 5, 15 * 60 * 1000)) {
    return { ok: false, error: "Too many reset requests — try again in 15 minutes." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Always report success so the form can't be used to probe for accounts.
  if (!user) return { ok: true };

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expires: new Date(Date.now() + 2 * HOUR) },
  });

  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const link = `${base}/reset-password/${token}`;
  const { delivered } = await sendMail({
    to: email,
    subject: "Reset your Heat Chart password",
    text: `Someone (hopefully you) asked to reset your Heat Chart password.\n\nReset it here (link valid for 2 hours):\n${link}\n\nIf this wasn't you, ignore this email.`,
  });

  // No email service configured (local/dev): hand the link back so the
  // flow still works. Never do this when a mailer is set up.
  if (!delivered && process.env.NODE_ENV !== "production") {
    return { ok: true, devResetLink: link };
  }
  return { ok: true };
}

export async function resetPassword(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const pwErr = validPassword(password);
  if (pwErr) return { ok: false, error: pwErr };

  const row = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!row || row.expires < new Date()) {
    return { ok: false, error: "This reset link is invalid or expired — request a new one." };
  }

  await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash: await hash(password, 10) },
  });
  await prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } });
  return { ok: true };
}

export async function updateProfile(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in first." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const shoeSize = String(formData.get("shoeSize") ?? "").trim();
  const favoriteSilhouette = String(formData.get("favoriteSilhouette") ?? "").trim();
  const favoriteBrands = String(formData.get("favoriteBrands") ?? "").trim();
  const styleInterests = String(formData.get("styleInterests") ?? "").trim();
  const instagram = String(formData.get("instagram") ?? "").trim().replace(/^@/, "");
  const marketingOptIn = formData.get("marketingOptIn") === "on";

  if (!name || name.length > 60) return { ok: false, error: "Name is required." };
  if (
    phone.length > 30 || city.length > 60 || shoeSize.length > 10 ||
    favoriteSilhouette.length > 60 || favoriteBrands.length > 120 ||
    styleInterests.length > 120 || instagram.length > 40
  ) {
    return { ok: false, error: "One of the fields is too long." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      phone: phone || null,
      city: city || null,
      shoeSize: shoeSize || null,
      favoriteSilhouette: favoriteSilhouette || null,
      favoriteBrands: favoriteBrands || null,
      styleInterests: styleInterests || null,
      instagram: instagram || null,
      marketingOptIn,
    },
  });

  revalidatePath("/profile");
  return { ok: true };
}

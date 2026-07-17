"use server";

import { prisma } from "@/lib/db";
import { getOrCreateVoterKey } from "@/lib/voter";
import { checkPassword, setAdminSession, clearAdminSession, isAdmin } from "@/lib/admin";
import { finalizeExpiredBattles } from "@/lib/battles";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export type ActionResult = { ok: boolean; error?: string };

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
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
  const title = String(formData.get("title") ?? "").trim();
  const artistName = String(formData.get("artistName") ?? "").trim();
  const socialHandle = String(formData.get("socialHandle") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const baseShoe = String(formData.get("baseShoe") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const image = formData.get("image");

  if (!title || title.length > 80) return { ok: false, error: "Give your custom a name (max 80 characters)." };
  if (!artistName || artistName.length > 60) return { ok: false, error: "Artist name is required." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "A valid email is required so we can reach you if you win." };
  if (!baseShoe) return { ok: false, error: "Tell us the base shoe (e.g. Air Force 1, Dunk Low)." };
  if (description.length > 600) return { ok: false, error: "Description is too long (max 600 characters)." };

  if (!(image instanceof File) || image.size === 0) return { ok: false, error: "Upload a photo of your custom." };
  if (image.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Photo must be under 6MB." };
  const ext = ALLOWED_TYPES[image.type];
  if (!ext) return { ok: false, error: "Photo must be a JPG, PNG, or WebP." };

  const fileName = `${randomUUID()}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, fileName), Buffer.from(await image.arrayBuffer()));

  await prisma.submission.create({
    data: {
      title,
      artistName,
      socialHandle: socialHandle ? socialHandle.replace(/^@/, "") : null,
      email,
      baseShoe,
      description: description || null,
      imageUrl: `/api/uploads/${fileName}`,
    },
  });

  revalidatePath("/admin");
  return { ok: true };
}

// ---------- Voting ----------

export async function castVote(battleId: string, submissionId: string): Promise<ActionResult> {
  await finalizeExpiredBattles();

  const battle = await prisma.battle.findUnique({ where: { id: battleId } });
  if (!battle) return { ok: false, error: "Battle not found." };
  if (battle.status !== "ACTIVE") return { ok: false, error: "This battle has ended." };
  if (submissionId !== battle.subAId && submissionId !== battle.subBId) {
    return { ok: false, error: "That shoe isn't in this battle." };
  }

  const voterKey = await getOrCreateVoterKey();
  try {
    await prisma.vote.create({ data: { battleId, submissionId, voterKey } });
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

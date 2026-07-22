"use server";

import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { siteUrl } from "@/lib/articles";
import { blastEverywhere, type BlastResult } from "@/lib/socialInstant";

export type BlastState = {
  ok: boolean;
  error?: string;
  results?: BlastResult[];
};

/**
 * The Battle Blast: one battle → a "which do you prefer?" post with
 * both photos + the vote link, fired at every configured instant
 * channel at once. Meta stays out of this path — it runs through the
 * existing Broadcast once that API wakes up.
 */
export async function blastBattle(
  _prev: BlastState | null,
  formData: FormData
): Promise<BlastState> {
  if (!(await isAdmin())) return { ok: false, error: "Admins only." };

  const battleId = String(formData.get("battleId") ?? "");
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      subA: { select: { title: true, artistName: true, imageUrl: true } },
      subB: { select: { title: true, artistName: true, imageUrl: true } },
    },
  });
  if (!battle) return { ok: false, error: "Battle not found." };
  if (battle.status !== "ACTIVE") return { ok: false, error: "That battle already ended." };

  const custom = String(formData.get("text") ?? "").trim();
  const text =
    custom ||
    `🔥 Which one you got — ${battle.subA.title} or ${battle.subB.title}? Come cast your vote.`;
  const link = `${siteUrl()}/battles/${battle.id}?utm_source=blast&utm_medium=social&utm_campaign=battle`;

  const results = await blastEverywhere({
    text,
    link,
    imageUrls: [battle.subA.imageUrl, battle.subB.imageUrl],
  });

  const posted = results.filter((r) => r.ok).length;
  return {
    ok: posted > 0,
    ...(posted === 0 ? { error: "No channel accepted the post — check the keys." } : {}),
    results,
  };
}

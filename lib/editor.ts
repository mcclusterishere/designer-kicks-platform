import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

/**
 * The Editor Desk privilege. An EDITOR is a normal member account with the
 * role flag set — they get the scoped /editor desk (content, cross-posting,
 * mild outreach, messaging the office) but never the admin panel. Admins
 * can do everything an editor can, so admin access satisfies these too.
 */
export type SessionUserRole = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

export async function currentUserRole(): Promise<SessionUserRole | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true },
  });
}

export async function isEditor(): Promise<boolean> {
  const u = await currentUserRole();
  return u?.role === "EDITOR";
}

/** Editor Desk access = the editor role OR admin. */
export async function editorDeskOk(): Promise<boolean> {
  if (await isEditor()) return true;
  return isAdmin();
}

/** The public origin, no trailing slash — used to build shareable links. */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** An editor's shareable tracked link, or null if they have no code yet. */
export function editorRefLink(refCode: string | null | undefined): string | null {
  return refCode ? `${siteOrigin()}/?ref=${encodeURIComponent(refCode)}` : null;
}

/**
 * Turn a name into a clean base handle for a tracking code — letters and
 * digits only, lowercased ("Seth" → "seth", "DJ Kicks!" → "djkicks").
 */
function baseRefCode(seed: string): string {
  const base = seed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  return base || "editor";
}

/**
 * Mint a unique, human-readable ref code for an editor (idempotent: if
 * they already have one, keep it). "seth", else "seth2", "seth3", …
 */
export async function ensureRefCode(userId: string, nameOrEmail: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { refCode: true } });
  if (existing?.refCode) return existing.refCode;

  const base = baseRefCode(nameOrEmail.split("@")[0] ?? nameOrEmail);
  let code = base;
  for (let n = 2; n < 1000; n++) {
    const taken = await prisma.user.findUnique({ where: { refCode: code }, select: { id: true } });
    if (!taken) break;
    code = `${base}${n}`;
  }
  await prisma.user.update({ where: { id: userId }, data: { refCode: code } });
  return code;
}

/** What one successful onboarding pays the editor, in cents. */
export const ONBOARDING_PAY_CENTS = 50;
/** How many the intern is asked to pull into the system each day. */
export const DAILY_QUOTA = 20;
/** A staged artist "counts" (is payable) once it has this many pieces. */
export const PIECES_TO_COMPLETE = 2;

export type StagedArtist = {
  id: string;
  displayName: string;
  slug: string;
  pieces: number;
  complete: boolean; // has ≥ PIECES_TO_COMPLETE pieces
  createdToday: boolean;
};

export type OnboardingStats = {
  refCode: string | null;
  refLink: string | null;
  quota: number;
  payCents: number;
  doneToday: number; // payable artists staged today
  wipToday: number; // staged today but still short a piece
  totalDone: number; // all-time payable
  earningsCents: number; // totalDone × payCents
  staged: StagedArtist[]; // most-recent first, for the desk list
};

function startOfTodayUTC(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

/**
 * The editor's onboarding scoreboard — how many artists they've staged,
 * how many are payable (≥2 pieces), today's count against the daily
 * quota, and what they've earned at $0.50 each. Also mints their tracked
 * ref link on first look if they don't have one yet.
 */
export async function getOnboardingStats(userId: string, nameOrEmail: string): Promise<OnboardingStats> {
  const [refCode, rows] = await Promise.all([
    ensureRefCode(userId, nameOrEmail),
    prisma.artistProfile.findMany({
      where: { onboardedById: userId },
      select: { id: true, displayName: true, slug: true, createdAt: true, _count: { select: { submissions: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  const midnight = startOfTodayUTC().getTime();
  const staged: StagedArtist[] = rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    slug: r.slug,
    pieces: r._count.submissions,
    complete: r._count.submissions >= PIECES_TO_COMPLETE,
    createdToday: r.createdAt.getTime() >= midnight,
  }));

  const totalDone = staged.filter((s) => s.complete).length;
  const doneToday = staged.filter((s) => s.complete && s.createdToday).length;
  const wipToday = staged.filter((s) => !s.complete && s.createdToday).length;

  return {
    refCode,
    refLink: editorRefLink(refCode),
    quota: DAILY_QUOTA,
    payCents: ONBOARDING_PAY_CENTS,
    doneToday,
    wipToday,
    totalDone,
    earningsCents: totalDone * ONBOARDING_PAY_CENTS,
    staged,
  };
}

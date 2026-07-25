import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * A stable-enough identity for someone who hasn't signed up.
 *
 * The signup wall was the single biggest thing standing between a link on
 * Instagram and a vote, so it comes down. But an anonymous voter can't be
 * held to the same standard as an account, and pretending otherwise would
 * quietly make the Heat List spoofable — so guest votes are kept and shown,
 * and the league reads account votes only.
 *
 * The key is a random id signed with AUTH_SECRET. Signing doesn't stop
 * somebody clearing cookies to vote again; nothing can. What it does stop is
 * hand-crafting arbitrary keys to stuff a ballot in bulk, which is the
 * difference between an annoyance and an attack.
 */

const COOKIE = "thc-guest";
const MAX_AGE = 60 * 60 * 24 * 365;

function secret(): string {
  // Falls back to a per-process value so local dev works without config.
  // A restart invalidates old guest keys, which is fine for dev and never
  // happens in production, where AUTH_SECRET is always set.
  return process.env.AUTH_SECRET || PROCESS_FALLBACK;
}
const PROCESS_FALLBACK = randomBytes(32).toString("hex");

function sign(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("base64url").slice(0, 32);
}

function parse(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  const expected = sign(id);
  if (mac.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return /^[a-f0-9]{24}$/.test(id) ? id : null;
}

/**
 * The caller's guest key, minted on first use.
 *
 * Returns the key and whether it had to be created, because a server action
 * can set a cookie but a page render can't always — the caller decides what
 * to do with a fresh one.
 */
export async function guestKey(): Promise<{ key: string; fresh: boolean }> {
  const jar = await cookies();
  const existing = parse(jar.get(COOKIE)?.value);
  if (existing) return { key: `guest:${existing}`, fresh: false };

  const id = randomBytes(12).toString("hex");
  try {
    jar.set(COOKIE, `${id}.${sign(id)}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE,
    });
  } catch {
    // Rendering a page rather than handling an action: the cookie can't be
    // written here. The key still works for this request.
  }
  return { key: `guest:${id}`, fresh: true };
}

/** Read-only: whoever this is, without minting anything. */
export async function existingGuestKey(): Promise<string | null> {
  const jar = await cookies();
  const id = parse(jar.get(COOKIE)?.value);
  return id ? `guest:${id}` : null;
}

export function isGuestKey(voterKey: string): boolean {
  return voterKey.startsWith("guest:");
}

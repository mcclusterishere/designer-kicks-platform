import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const VOTER_COOKIE = "dk_voter";

/**
 * Identifies a voter across battles with a long-lived anonymous cookie.
 * Returns the existing key, or mints one and sets the cookie (only valid
 * inside a Server Action / Route Handler).
 */
export async function getOrCreateVoterKey(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VOTER_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;

  const key = randomUUID();
  jar.set(VOTER_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return key;
}

export async function getVoterKey(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(VOTER_COOKIE)?.value ?? null;
}

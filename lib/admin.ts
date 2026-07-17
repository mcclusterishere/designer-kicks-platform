import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "crypto";

const ADMIN_COOKIE = "dk_admin";
const SESSION_HOURS = 12;
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * The "heatcheck" default exists for local development only. In
 * production, admin login is disabled entirely until ADMIN_PASSWORD is
 * set — a shared default in prod is an open door.
 */
function adminPassword(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (pw) return pw;
  return process.env.NODE_ENV === "production" ? null : "heatcheck";
}

function secret(): string {
  return process.env.AUTH_SECRET || "dk-dev-secret";
}

function sha256(input: string): Buffer {
  return createHash("sha256").update(input).digest();
}

// Token = "<expiryMs>.<hmac>", where the HMAC covers the expiry and the
// current password hash — so tokens expire on schedule and all sessions
// die immediately when the password changes.
function sign(expiry: number, pw: string): string {
  return createHmac("sha256", secret())
    .update(`dk-admin:${expiry}:${sha256(pw).toString("hex")}`)
    .digest("hex");
}

export function checkPassword(password: string): boolean {
  const pw = adminPassword();
  if (!pw) return false;
  return timingSafeEqual(sha256(password), sha256(pw));
}

export function adminLoginAvailable(): boolean {
  return adminPassword() !== null;
}

// Best-effort in-memory limiter (per server instance) against
// credential stuffing on the admin form.
const attempts = new Map<string, { count: number; windowStart: number }>();

export function registerLoginAttempt(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.windowStart > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

export async function setAdminSession() {
  const pw = adminPassword();
  if (!pw) return;
  const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, `${expiry}.${sign(expiry, pw)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_HOURS * 60 * 60,
    path: "/",
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const pw = adminPassword();
  if (!pw) return false;

  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  if (!raw) return false;

  const dot = raw.indexOf(".");
  if (dot < 1) return false;
  const expiry = Number(raw.slice(0, dot));
  const sig = raw.slice(dot + 1);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

  const expected = sign(expiry, pw);
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

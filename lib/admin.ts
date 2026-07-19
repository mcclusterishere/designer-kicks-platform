import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual, randomBytes } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const ADMIN_COOKIE = "dk_admin";
const SESSION_HOURS = 12;
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const NONCE_KEY = "adminNonce";

/**
 * The admin-session nonce lives in the DB. Every admin cookie is signed
 * with the CURRENT nonce; rotating it (on logout) instantly invalidates
 * every cookie ever issued — real server-side revocation across all
 * devices, and a copied/leaked cookie dies the moment the admin logs
 * out. Created lazily on first login.
 */
async function currentNonce(): Promise<string> {
  const row = await prisma.appSetting.upsert({
    where: { key: NONCE_KEY },
    update: {},
    create: { key: NONCE_KEY, value: randomBytes(16).toString("hex") },
  });
  return row.value;
}

async function rotateNonce(): Promise<void> {
  const value = randomBytes(16).toString("hex");
  await prisma.appSetting.upsert({
    where: { key: NONCE_KEY },
    update: { value },
    create: { key: NONCE_KEY, value },
  });
}

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
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  // Never sign admin cookies with a public constant in a real deploy.
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set in production.");
  }
  return "dk-dev-secret";
}

function sha256(input: string): Buffer {
  return createHash("sha256").update(input).digest();
}

// Token = "<expiryMs>.<hmac>", where the HMAC covers the expiry, the
// current password hash, and the current session nonce — so tokens
// expire on schedule, die when the password changes, AND die when the
// admin logs out (nonce rotation).
function sign(expiry: number, pw: string, nonce: string): string {
  return createHmac("sha256", secret())
    .update(`dk-admin:${expiry}:${sha256(pw).toString("hex")}:${nonce}`)
    .digest("hex");
}

/**
 * Second lock: when ADMIN_EMAILS is set (comma-separated), the admin
 * panel additionally requires being signed in as one of those member
 * accounts. A leaked password alone is then useless. Unset = legacy
 * password-only mode (local dev / tests).
 */
export function adminAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * A real, public deployment. True if a real https site URL is
 * configured OR we're running on Railway (env markers it injects) —
 * so a prod box that simply forgot to set NEXT_PUBLIC_SITE_URL still
 * fails closed instead of silently dropping to password-only admin.
 * Local + e2e (no https URL, no Railway markers) stay password-only.
 */
function isRealDeploy(): boolean {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").toLowerCase();
  if (/^https:\/\//.test(site) && !site.includes("localhost")) return true;
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_ID
  );
}

export async function adminAccountOk(): Promise<boolean> {
  const list = adminAllowlist();
  if (list.length === 0) {
    // Fail closed on the live site: a password alone is never enough.
    // The owner MUST set ADMIN_EMAILS (their signed-in member account)
    // so a leaked/guessed password can't reach the panel. Local + e2e
    // (no real https host) stay password-only so dev and tests work.
    return !isRealDeploy();
  }
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  return Boolean(email && list.includes(email));
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

/**
 * A correct password clears the counter for that key. Successful
 * logins must never eat the brute-force budget — only wrong guesses
 * count against the 10-per-15-minutes window.
 */
export function clearLoginAttempts(key: string) {
  attempts.delete(key);
}

export async function setAdminSession() {
  const pw = adminPassword();
  if (!pw) return;
  const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const nonce = await currentNonce();
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, `${expiry}.${sign(expiry, pw, nonce)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_HOURS * 60 * 60,
    path: "/",
  });
}

export async function clearAdminSession() {
  // Real revocation: rotate the nonce so every issued admin cookie —
  // this device and any other — stops verifying immediately.
  await rotateNonce();
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

  const nonce = await currentNonce();
  const expected = sign(expiry, pw, nonce);
  if (sig.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;

  // Three locks: valid password session, the current nonce (killed on
  // logout), AND (in prod) the owner's signed-in account.
  return adminAccountOk();
}

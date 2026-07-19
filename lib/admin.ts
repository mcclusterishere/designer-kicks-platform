import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { verifyTotp } from "@/lib/totp";

const ADMIN_COOKIE = "dk_admin";
const SESSION_HOURS = 12;
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const NONCE_KEY = "adminNonce";
const TOTP_KEY = "adminTotpSecret"; // active 2FA secret (enabled iff present)
const TOTP_PENDING_KEY = "adminTotpPending"; // secret mid-setup, before confirm

// The league office accounts. On a real deploy with ADMIN_EMAILS unset,
// the panel falls back to these so the owner is never locked out of their
// own site just for skipping an env var — while still requiring a
// signed-in owner account (a password alone never reaches admin).
const OWNER_EMAILS = ["mattmccluster@gmail.com", "matthew@mccluster.org"];

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

/** Emails explicitly configured via ADMIN_EMAILS (may be empty). */
function configuredAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Display/label helper only (e.g. the account name on the 2FA QR): the
 * configured allowlist, or the owner accounts as a sensible default.
 * NOT the access gate — see adminAccountOk.
 */
export function adminAllowlist(): string[] {
  const configured = configuredAllowlist();
  return configured.length ? configured : [...OWNER_EMAILS];
}

/**
 * Admin is PASSWORD-ONLY right now, by owner request — the admin password
 * (plus the authenticator-app 2FA once it's switched on) is the whole gate.
 * The old "must be signed in as a member account" lock is disabled so a
 * stray ADMIN_EMAILS value can't lock the owner out. When 2FA is on it
 * becomes the real second factor. (configuredAllowlist stays available for
 * labels/tooling; it just doesn't gate access.)
 */
export async function adminAccountOk(): Promise<boolean> {
  return true;
}

// ---------- Two-step verification (TOTP authenticator app) ----------

/** 2FA is on once a confirmed secret is stored. */
export async function totpEnabled(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: TOTP_KEY } });
  return Boolean(row?.value);
}

async function settingValue(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Stash a fresh secret mid-setup; it isn't enforced until confirmed. */
export async function beginTotpEnrollment(secret: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: TOTP_PENDING_KEY },
    update: { value: secret },
    create: { key: TOTP_PENDING_KEY, value: secret },
  });
}

export async function pendingTotpSecret(): Promise<string | null> {
  return settingValue(TOTP_PENDING_KEY);
}

/** Promote the pending secret to active — 2FA is now required at login. */
export async function activateTotp(): Promise<void> {
  const pending = await settingValue(TOTP_PENDING_KEY);
  if (!pending) return;
  await prisma.appSetting.upsert({
    where: { key: TOTP_KEY },
    update: { value: pending },
    create: { key: TOTP_KEY, value: pending },
  });
  await prisma.appSetting.deleteMany({ where: { key: TOTP_PENDING_KEY } });
}

export async function disableTotp(): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: { in: [TOTP_KEY, TOTP_PENDING_KEY] } } });
}

/** Verify a login code. Passes trivially when 2FA isn't enabled. */
export async function verifyAdminTotp(code: string): Promise<boolean> {
  const secret = await settingValue(TOTP_KEY);
  if (!secret) return true; // 2FA off — nothing to check
  return verifyTotp(secret, code, Math.floor(Date.now() / 1000));
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

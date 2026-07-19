/**
 * TOTP (RFC 6238) — authenticator-app 2FA, dependency-free.
 *
 * Standard 30-second step, 6 digits, HMAC-SHA1 — the defaults Google
 * Authenticator, Authy, 1Password, and every other TOTP app expect. The
 * shared secret is base32 (RFC 4648, no padding), which is what those
 * apps read from an otpauth:// URI or a typed setup key.
 *
 * We hand-roll it (Node crypto only) rather than pull a dependency: it's
 * ~60 lines and keeps the build lean.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Fresh 160-bit secret as a base32 string (what the admin scans/types). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue; // skip stray chars
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** The 6-digit code for a given secret at a given unix time (seconds). */
export function totpToken(secret: string, forTimeSec: number): string {
  const counter = Math.floor(forTimeSec / STEP_SECONDS);
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  // 64-bit big-endian counter (high 32 bits are ~always 0 for our range).
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Verify a user-entered code against the secret, tolerating ±`window`
 * steps of clock skew (default ±1 = the code before/after now, so a
 * slightly-off phone clock still works). Constant-time compare.
 */
export function verifyTotp(secret: string, code: string, nowSec: number, window = 1): boolean {
  const entered = (code || "").replace(/\D/g, "");
  if (entered.length !== DIGITS) return false;
  for (let w = -window; w <= window; w++) {
    const expected = totpToken(secret, nowSec + w * STEP_SECONDS);
    if (
      expected.length === entered.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(entered))
    ) {
      return true;
    }
  }
  return false;
}

/** otpauth:// URI an authenticator app turns into a QR / setup entry. */
export function otpauthUri(secret: string, account: string, issuer = "The Heat Chart"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

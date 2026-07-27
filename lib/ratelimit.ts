/**
 * Fixed-window in-memory rate limiter. Per server instance — good
 * enough to blunt casual abuse and scripted spam on a single host or a
 * small number of serverless instances. For serious scale, swap the
 * Map for Redis/Upstash while keeping this call signature.
 */
const buckets = new Map<string, { count: number; windowStart: number }>();

export function allowAttempt(
  bucket: string,
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const mapKey = `${bucket}:${key}`;
  const entry = buckets.get(mapKey);
  if (!entry || now - entry.windowStart > windowMs) {
    buckets.set(mapKey, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

/**
 * Check a limit WITHOUT spending it, and say how long is left if it's hit.
 *
 * `allowAttempt` charges on every call, which is right for a login form —
 * a failed password is exactly the thing you want to limit. It is wrong
 * for anything where the operation can fail for the user's own innocent
 * reasons. An artist whose upload keeps failing retries, and each retry
 * burns a slot, so the platform locks out the person who was trying
 * hardest to use it while never letting a single post through.
 *
 * Pair this with `spendAttempt` on the success path so the budget counts
 * what actually happened, not what was attempted.
 */
export function checkAttempt(
  bucket: string,
  key: string,
  max: number,
  windowMs: number
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = buckets.get(`${bucket}:${key}`);
  if (!entry || now - entry.windowStart > windowMs) return { ok: true, retryAfterMs: 0 };
  if (entry.count < max) return { ok: true, retryAfterMs: 0 };
  return { ok: false, retryAfterMs: Math.max(0, windowMs - (now - entry.windowStart)) };
}

/** Spend one unit of a limit. Call this only once the work succeeded. */
export function spendAttempt(bucket: string, key: string, windowMs: number): void {
  const now = Date.now();
  const mapKey = `${bucket}:${key}`;
  const entry = buckets.get(mapKey);
  if (!entry || now - entry.windowStart > windowMs) {
    buckets.set(mapKey, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

/** "in 12 minutes" / "in an hour" — a real number beats a vague one. */
export function retryLabel(retryAfterMs: number): string {
  const mins = Math.ceil(retryAfterMs / 60000);
  if (mins <= 1) return "in a minute";
  if (mins < 60) return `in ${mins} minutes`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? "in an hour" : `in ${hours} hours`;
}

// Occasional sweep so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now - v.windowStart > 60 * 60 * 1000) buckets.delete(k);
  }
}, 10 * 60 * 1000).unref?.();

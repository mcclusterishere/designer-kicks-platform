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

// Occasional sweep so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now - v.windowStart > 60 * 60 * 1000) buckets.delete(k);
  }
}, 10 * 60 * 1000).unref?.();

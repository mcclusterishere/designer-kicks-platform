/**
 * Loose shoe-size matching for the "fits you" badge. Sizes come in
 * free-typed from the passport ("US 10.5", "10.5", "M 10 1/2") and
 * from pieces the same messy way, so we normalize to a comparable
 * token before matching — better a near-miss than a silent no-match.
 */
export function normalizeSize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.toLowerCase();
  // Strip region/gender prefixes and the word "size".
  s = s.replace(/\b(us|uk|eu|mens?|womens?|w|size)\b/g, " ");
  // "10 1/2" → "10.5"; "½" → ".5".
  s = s.replace(/\b(\d+)\s*1\/2\b/g, "$1.5").replace(/½/g, ".5");
  const m = s.match(/\d+(\.\d+)?/);
  return m ? m[0].replace(/\.0$/, "") : null;
}

/** True when a piece's size is the member's size. */
export function fitsMember(
  pieceSize: string | null | undefined,
  memberSize: string | null | undefined
): boolean {
  const a = normalizeSize(pieceSize);
  const b = normalizeSize(memberSize);
  return Boolean(a && b && a === b);
}

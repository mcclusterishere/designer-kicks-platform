/**
 * Is this pair a collaboration?
 *
 * Rarity answers "is it hard to get". This answers a different question
 * — "does it have somebody's name on it" — and the two do not agree.
 * A Panda Dunk is a general release that sells forever and is never
 * rare. A Travis Scott anything is a collab whether or not it has
 * spiked yet. The site's editorial line needs both, because a collab
 * that has not released has no market price and would otherwise read as
 * "unpriced" and get swept out with the commoners.
 *
 * This is a NAME heuristic and nothing more. Providers do not ship a
 * "collab" flag, so the signal has to come from how the industry writes
 * product names. It is deliberately conservative: it would rather miss
 * a collab than mislabel a general release, because the consequence of
 * a false positive here is a commoner surviving a purge, while a false
 * negative on the other side is a $2,000 pair getting hidden.
 */

/**
 * The universal marker. Every collab in every brand's naming convention
 * gets an "x" between the two names — "Victor Victor x Nike Air Force
 * 1", "Travis Scott x Air Jordan 1". Spaces on both sides matter: a
 * bare "x" would match "Air Max" and every SKU with an x in it.
 */
const X_JOIN = /\s[xX×]\s/;

/**
 * Names that mean collab on their own, because the industry drops the
 * "x" as often as it uses it — "Air Jordan 1 Fragment" has no x in it.
 *
 * Plain data so it can be extended without touching the logic, and so a
 * test can assert against it. Lowercase; matching is case-insensitive.
 */
export const COLLAB_NAMES: string[] = [
  // Streetwear and boutique
  "off-white", "off white", "fragment", "sacai", "comme des garcons", "cdg",
  "supreme", "stussy", "stüssy", "undefeated", "undftd", "patta", "concepts",
  "kith", "bodega", "a ma maniere", "a-ma-maniere", "aime leon dore", "ald",
  "social status", "union", "clot", "atmos", "sns", "sneakersnstuff",
  "end.", "size?", "footpatrol", "solebox", "packer", "extra butter",
  "kasina", "dover street market", "dsm", "notre", "wish atl", "shoe palace",
  "trophy room", "sole fly", "solefly", "hidden ny", "awake ny", "corteiz",
  "denim tears", "nina chanel", "grateful dead", "ben & jerry", "ben and jerry",
  // Designers and houses
  "dior", "louis vuitton", "tiffany", "ambush", "fear of god", "jacquemus",
  "martine rose", "matthew m williams", "mmw", "acronym", "cactus plant flea market",
  "cpfm", "bode", "jjjjound", "hender scheme", "kiko kostadinov", "auralee",
  // People and imprints
  "travis scott", "cactus jack", "virgil", "nigo", "verdy", "hiroshi",
  "j balvin", "dj khaled", "nigel sylvester", "sean wotherspoon", "tom sachs",
  "billie eilish", "drake", "nocta", "yeezy", "eminem", "gunna", "latto",
  "victor victor", "hello kitty", "sponge bob", "spongebob", "stranger things",
  "doernbecher", "what the",
  // Teams, schools, institutions that function as collabs
  "paris saint-germain", "psg", "university of", "wu-tang",
];

/**
 * Words that look like a collaborator but are just Nike's own sub-lines.
 * Without this, "Nike SB Dunk Low Pro" reads as a collab because SB
 * co-brands like one — and there are thousands of plain SB Dunks.
 */
const NOT_COLLABS = ["nike sb", "jordan brand", "nike air", "air jordan", "nike x nike"];

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isCollabName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = normalise(name);

  // A named collaborator is decisive on its own.
  if (COLLAB_NAMES.some((c) => n.includes(c))) return true;

  // The "x" join, but only when what sits either side of it is a real
  // name rather than one of Nike's own house labels talking to itself.
  if (X_JOIN.test(name)) {
    const [left] = name.split(X_JOIN);
    const l = normalise(left ?? "");
    if (l.length >= 2 && !NOT_COLLABS.some((h) => l === h)) return true;
  }
  return false;
}

/** The reason, for a UI that has to explain why a pair was kept. */
export function collabReason(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = normalise(name);
  const hit = COLLAB_NAMES.find((c) => n.includes(c));
  if (hit) return `names ${hit}`;
  if (X_JOIN.test(name)) return "has an “x” collaboration join";
  return null;
}

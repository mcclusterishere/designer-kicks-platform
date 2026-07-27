/**
 * Email-domain typo guard for signup. One wrong letter in the domain
 * and an account can never reset its password or hear from the league
 * (learned the hard way from a real member's "gnail.com").
 *
 * - Domain IS a known provider → clean pass.
 * - Domain is one keystroke off a known provider → hard block with the
 *   correction offered ("did you mean gmail.com?").
 * - Anything else (self-hosted domains like mccluster.org) → the
 *   caller shows a confirm-it interstitial before accepting.
 */

// The providers people actually use — global majors, Apple/Microsoft
// legacies, US ISPs, privacy mail, and the big regional players.
export const KNOWN_PROVIDERS = [
  "gmail.com", "googlemail.com",
  "yahoo.com", "ymail.com", "rocketmail.com", "yahoo.co.uk", "yahoo.fr",
  "hotmail.com", "hotmail.co.uk", "hotmail.fr", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com",
  "proton.me", "protonmail.com", "pm.me", "tutanota.com", "hey.com", "fastmail.com",
  "mail.com", "gmx.com", "gmx.net", "zoho.com", "yandex.com", "yandex.ru", "mail.ru",
  "comcast.net", "xfinity.com", "verizon.net", "att.net", "sbcglobal.net",
  "bellsouth.net", "cox.net", "charter.net", "spectrum.net", "earthlink.net",
  "btinternet.com", "sky.com", "virginmedia.com",
  "qq.com", "163.com", "126.com", "naver.com", "daum.net",
  "web.de", "t-online.de", "orange.fr", "free.fr", "sfr.fr", "libero.it",
  "hotmail.es", "outlook.es", "uol.com.br", "bol.com.br",
] as const;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[n];
}

export type DomainVerdict =
  | { verdict: "ok" }
  | { verdict: "typo"; suggestion: string }
  | { verdict: "unknown"; domain: string };

export function checkEmailDomain(email: string): DomainVerdict {
  const at = email.lastIndexOf("@");
  if (at < 0) return { verdict: "ok" }; // input[type=email] handles shape
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return { verdict: "ok" };

  if ((KNOWN_PROVIDERS as readonly string[]).includes(domain)) return { verdict: "ok" };

  // One or two keystrokes from a major provider = almost certainly a
  // typo. Two-edit tolerance only for longer domains so short real
  // domains don't false-positive.
  let best: { provider: string; dist: number } | null = null;
  for (const p of KNOWN_PROVIDERS) {
    const dist = levenshtein(domain, p);
    if (!best || dist < best.dist) best = { provider: p, dist };
  }
  if (best && (best.dist === 1 || (best.dist === 2 && domain.length >= 9))) {
    return { verdict: "typo", suggestion: best.provider };
  }

  return { verdict: "unknown", domain };
}

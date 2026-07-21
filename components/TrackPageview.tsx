"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export const OPT_OUT_KEY = "hc-analytics-optout";

// First-party pageview beacon. Fires on every route change, respects Do
// Not Track and the opt-out switch on /privacy, and never runs on admin
// pages. No fingerprint libraries — the server sees only path, query,
// referrer, and user agent. One deliberate exception to cookieless:
// when a visitor ARRIVES on a tagged link (?ref= or utm_source — a link
// that already announces its tracking), the campaign name is kept in a
// first-touch cookie so an account created later can credit the
// campaign that brought them. No id, no fingerprint — just the tag.
export default function TrackPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return;
    try {
      if (localStorage.getItem(OPT_OUT_KEY) === "1") return;
    } catch {
      /* storage blocked — still fine to count the view */
    }
    // First-touch signup attribution — only from explicitly tagged links.
    try {
      if (!document.cookie.includes("hc_src=")) {
        const ref = (searchParams.get("ref") ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
        const utm = (searchParams.get("utm_source") ?? "").toLowerCase().trim().slice(0, 40);
        const src = ref ? `ref:${ref}` : utm;
        // Raw write is safe: both halves are sanitized to [a-z0-9_:-].
        if (src && /^[a-z0-9_:.-]+$/.test(src)) {
          document.cookie = `hc_src=${src}; path=/; max-age=${30 * 86400}; SameSite=Lax`;
        }
      }
    } catch {
      /* cookie blocked — attribution is best-effort */
    }
    const body = JSON.stringify({
      path: pathname,
      search,
      referrer: document.referrer || "",
    });
    const sent = navigator.sendBeacon?.(
      "/api/track",
      new Blob([body], { type: "application/json" })
    );
    if (!sent) {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname, search]);

  return null;
}

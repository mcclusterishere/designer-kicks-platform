"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export const OPT_OUT_KEY = "hc-analytics-optout";

// Cookieless first-party pageview beacon. Fires on every route change,
// respects Do Not Track and the opt-out switch on /privacy, and never
// runs on admin pages. No cookies, no fingerprint libraries — the
// server sees only path, query, referrer, and user agent.
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

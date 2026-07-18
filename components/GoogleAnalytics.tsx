"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { OPT_OUT_KEY } from "@/components/TrackPageview";

// Google Analytics 4, loaded only when NEXT_PUBLIC_GA_ID is set. Runs
// on the same rules as the first-party tracker: honors Do Not Track,
// honors the /privacy opt-out switch, never loads on admin pages.
// Sends page_view on every route change plus an affiliate_click event
// for every /go link tap — third-party-verifiable numbers for
// affiliate program applications (StockX/GOAT via Impact ask for them).
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function gtagSafe(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  // The official stub: queue into dataLayer until gtag.js drains it.
  window.gtag =
    window.gtag ||
    function (...inner: unknown[]) {
      window.dataLayer!.push(inner);
    };
  window.gtag(...args);
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!GA_ID) return;
    if (navigator.doNotTrack === "1") return;
    try {
      if (localStorage.getItem(OPT_OUT_KEY) === "1") return;
    } catch {}
    setEnabled(true);
  }, []);

  // Route-change pageviews (send_page_view is off in config — this
  // covers the first load and every client-side navigation once).
  useEffect(() => {
    if (!enabled || !pathname || pathname.startsWith("/admin")) return;
    gtagSafe("event", "page_view", { page_path: pathname });
  }, [enabled, pathname]);

  // Affiliate clicks: any tap on a /go link, tagged by merchant + ref.
  useEffect(() => {
    if (!enabled) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a[href*="/go?"]') as HTMLAnchorElement | null;
      if (!a) return;
      try {
        const u = new URL(a.href, location.origin);
        const dest = u.searchParams.get("u");
        gtagSafe("event", "affiliate_click", {
          merchant: dest ? new URL(dest).hostname.replace(/^www\./, "") : "unknown",
          link_ref: u.searchParams.get("ref") ?? "",
        });
      } catch {}
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled]);

  if (!GA_ID || !enabled) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { send_page_view: false, anonymize_ip: true });`}
      </Script>
    </>
  );
}

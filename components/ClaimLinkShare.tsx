"use client";

import { useState } from "react";

/**
 * The seller's hand-off link for an off-app buyer. One copy, one text
 * message, and the customer lands on a page that walks them into an
 * account and their claim — piece in their closet, provenance on the
 * chart, and a voter/collector the platform keeps.
 */
export default function ClaimLinkShare({ saleId, siteUrl }: { saleId: string; siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${siteUrl}/claim/${saleId}`;

  return (
    <div className="mt-2 rounded-md border border-edge bg-panel p-2.5">
      <p className="tag text-smoke">Send your buyer their claim link</p>
      <p className="mt-1 text-[11px] leading-relaxed text-smoke/80">
        Sold it in DMs or in person? Text them this — they make an
        account and the piece lands in their closet, officially on the
        chart.
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          readOnly
          value={url}
          aria-label="Buyer claim link"
          onFocus={(e) => e.currentTarget.select()}
          className="w-full min-w-0 rounded-md border border-edge bg-surface px-2.5 py-2 text-xs text-smoke"
        />
        <button
          onClick={() => {
            navigator.clipboard?.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="tag shrink-0 rounded-md border border-edge px-3 py-2 text-white transition hover:border-volt"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

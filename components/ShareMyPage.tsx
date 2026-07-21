"use client";

import { useState } from "react";

/**
 * The artist's distribution kit, right in the Studio: their public page
 * as a tracked link (utm_source=artist so their shares are measurable in
 * Traffic Pulse), ready-made captions, and one-tap share — Web Share on
 * phones, the Facebook dialog on desktop. IG doesn't take link posts, so
 * for IG the play is caption + link-in-bio; the copy button covers it.
 */
export default function ShareMyPage({
  slug,
  displayName,
  siteUrl,
}: {
  slug: string;
  displayName: string;
  siteUrl: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const link = `${siteUrl}/artists/${slug}?utm_source=artist&utm_medium=social&utm_campaign=${slug}`;

  const captions = [
    `My work is on The Heat Chart — the custom sneaker battle league. Vote for my pairs, follow the page, watch me climb. ${link}`,
    `They drafted me to the league. Every vote counts — pull up: ${link}`,
    `New heat on my Heat Chart page. Rate it, vote it, run it up. ${link}`,
  ];

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: displayName, text: captions[0], url: link });
        return;
      } catch {
        /* dismissed — fall through */
      }
    }
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=500"
    );
  }

  return (
    <div className="mt-12 rounded-xl border border-edge bg-surface p-5" data-testid="share-my-page">
      <p className="display text-xl text-white">Share your page</p>
      <p className="mt-1 text-sm text-smoke">
        This link is tagged to you — every visitor and vote it brings shows
        up as yours in the league&apos;s numbers. Post it everywhere you
        already have people.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-smoke">{link}</span>
        <button
          onClick={() => copy(link, "link")}
          className="tag shrink-0 font-bold text-volt transition hover:text-white"
        >
          {copied === "link" ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button onClick={share} className="btn-hard rounded-lg py-3 tag font-bold">
          Share To Facebook
        </button>
        <button
          onClick={() => copy(captions[0], "cap0")}
          className="btn-hard-volt rounded-lg py-3 tag font-bold"
        >
          {copied === "cap0" ? "Caption Copied ✓" : "Copy IG Caption"}
        </button>
      </div>

      <details className="mt-3">
        <summary className="tag cursor-pointer text-smoke transition hover:text-white">
          More ready-made captions
        </summary>
        <div className="mt-2 space-y-2">
          {captions.slice(1).map((c, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-edge bg-panel/40 p-3">
              <p className="min-w-0 flex-1 text-xs text-smoke">{c}</p>
              <button
                onClick={() => copy(c, `cap${i + 1}`)}
                className="tag shrink-0 font-bold text-volt transition hover:text-white"
              >
                {copied === `cap${i + 1}` ? "✓" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      </details>
      <p className="mt-3 text-xs text-smoke/70">
        Instagram tip: paste the caption on your next post and put the link
        in your bio — IG only counts taps from the bio link.
      </p>
    </div>
  );
}

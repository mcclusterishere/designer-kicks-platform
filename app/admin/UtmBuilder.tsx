"use client";

import { useState } from "react";

/**
 * Tracked-link factory. Pick the platform, name the campaign, get a
 * tagged URL — every visit it brings shows in Traffic Pulse under that
 * source, and every account it creates is stamped with it forever.
 */
const PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
  { key: "tiktok", label: "TikTok" },
];

export default function UtmBuilder({ siteUrl }: { siteUrl: string }) {
  const [platform, setPlatform] = useState("instagram");
  const [path, setPath] = useState("/games");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const camp = campaign.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 60);
  const link = `${siteUrl}${cleanPath}?utm_source=${platform}&utm_medium=social${camp ? `&utm_campaign=${camp}` : ""}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div data-testid="utm-builder">
      <div className="flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPlatform(p.key)}
            className={`tag rounded-full border px-3 py-1.5 transition ${
              platform === p.key ? "border-volt text-volt" : "border-edge text-smoke hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor="utm-path">Where it lands</label>
          <input
            id="utm-path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/games"
            className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
          />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor="utm-camp">Campaign name (optional)</label>
          <input
            id="utm-camp"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="reel-banned-myth"
            className="mt-1 w-full rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-smoke">{link}</span>
        <button onClick={copy} className="tag shrink-0 font-bold text-volt transition hover:text-white">
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

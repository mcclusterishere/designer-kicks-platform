"use client";

import { useState } from "react";
import { blockMember, reportContent } from "@/app/actions";

/**
 * The safety affordance App Review requires on every piece of member
 * content: report it, or block its author. Renders as a quiet flag
 * that expands into the two actions; feedback replaces the menu.
 */
export default function ModTools({
  kind,
  targetId,
  authorUserId,
  signedIn,
  className = "",
}: {
  kind: "feed_post" | "feed_comment" | "submission" | "artist";
  targetId: string;
  /** The content author — enables Block. Omit for house content. */
  authorUserId?: string | null;
  signedIn: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!signedIn) return null;
  if (note) return <span className={`tag text-smoke ${className}`}>{note}</span>;

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label="Report or block"
        onClick={() => setOpen((o) => !o)}
        className="tag rounded px-1.5 py-0.5 text-smoke/60 transition hover:text-white"
      >
        ⚑
      </button>
      {open && (
        <span className="absolute right-0 top-6 z-30 flex w-44 flex-col overflow-hidden rounded-lg border border-edge bg-panel shadow-xl">
          <button
            type="button"
            className="tag px-3 py-2.5 text-left text-white transition hover:bg-surface"
            onClick={async () => {
              setOpen(false);
              const res = await reportContent(kind, targetId);
              setNote(res.ok ? "Reported — we review within 24h" : res.error ?? "Try again");
            }}
          >
            Report this
          </button>
          {authorUserId && (
            <button
              type="button"
              className="tag border-t border-edge px-3 py-2.5 text-left text-white transition hover:bg-surface"
              onClick={async () => {
                setOpen(false);
                const res = await blockMember(authorUserId);
                setNote(res.ok ? "Blocked — refresh to update your feed" : res.error ?? "Try again");
              }}
            >
              Block this member
            </button>
          )}
        </span>
      )}
    </span>
  );
}

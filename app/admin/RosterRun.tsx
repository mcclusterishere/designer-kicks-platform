"use client";

import { useState } from "react";
import Link from "next/link";
import { logOutreachTouch } from "@/app/actions";
import type { RunItem } from "@/lib/rosterRun";

/**
 * Today's Roster Run — the recruiting queue, already prioritized. Each row
 * says who, why they're due, and hands over a written message. Copy, send,
 * log the touch; the queue reschedules them automatically.
 */
export default function RosterRun({
  items,
  counts,
}: {
  items: RunItem[];
  counts: { due: number; cold: number; neverTouched: number };
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(item: RunItem) {
    try {
      await navigator.clipboard.writeText(item.message);
      setCopied(item.artistId);
      setTimeout(() => setCopied((c) => (c === item.artistId ? null : c)), 1800);
    } catch {
      setOpen(item.artistId); // clipboard blocked — show it to copy by hand
    }
  }

  return (
    <div className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="tag text-volt">Today&apos;s Roster Run</p>
          <p className="mt-1 text-sm text-smoke">
            Who to contact right now, sorted by what moves the roster. Send the message,
            hit <span className="text-white">Logged</span>, and they reschedule themselves.
          </p>
        </div>
        <div className="flex gap-2 text-center">
          <div className="rounded-lg border border-edge bg-panel px-3 py-1.5">
            <p className="display text-xl text-white">{counts.due}</p>
            <p className="tag text-smoke">due</p>
          </div>
          <div className="rounded-lg border border-edge bg-panel px-3 py-1.5">
            <p className="display text-xl text-volt">{counts.neverTouched}</p>
            <p className="tag text-smoke">new</p>
          </div>
          <div className="rounded-lg border border-edge bg-panel px-3 py-1.5">
            <p className="display text-xl text-heat">{counts.cold}</p>
            <p className="tag text-smoke">cold</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-smoke">
            Queue&apos;s clear — nobody&apos;s due today. Stage more prospects and they&apos;ll
            show up here the moment they need a touch.
          </p>
        ) : (
          items.map((it) => (
            <div key={it.artistId} className="rounded-lg border border-edge bg-panel p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-white">
                    <Link href={`/artists/${it.slug}`} className="hover:text-volt">{it.name}</Link>
                    <span className={`tag ml-2 ${it.cold ? "text-heat" : "text-smoke"}`}>{it.reason}</span>
                  </p>
                  <p className="tag text-smoke">
                    {it.action}
                    {it.pieceCount > 0 && ` · ${it.pieceCount} piece${it.pieceCount === 1 ? "" : "s"} staged`}
                    {it.instagram && ` · @${it.instagram}`}
                    {it.touchCount > 0 && ` · ${it.touchCount} touch${it.touchCount === 1 ? "" : "es"}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {it.instagram && (
                    <a
                      href={`https://instagram.com/${it.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-edge px-2.5 py-1.5 tag text-white"
                    >
                      DM
                    </a>
                  )}
                  <button
                    onClick={() => copy(it)}
                    className="rounded border border-volt px-2.5 py-1.5 tag font-bold text-volt"
                  >
                    {copied === it.artistId ? "Copied ✓" : "Copy message"}
                  </button>
                  <button
                    onClick={() => setOpen(open === it.artistId ? null : it.artistId)}
                    className="rounded border border-edge px-2.5 py-1.5 tag text-smoke"
                  >
                    {open === it.artistId ? "Hide" : "View"}
                  </button>
                  <form action={logOutreachTouch.bind(null, it.artistId, undefined)}>
                    <button className="rounded btn-hard px-2.5 py-1.5 tag font-bold">Logged</button>
                  </form>
                </div>
              </div>

              {open === it.artistId && (
                <textarea
                  readOnly
                  value={it.message}
                  rows={8}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mt-2 w-full rounded border border-edge bg-surface p-2.5 font-mono text-xs text-white"
                />
              )}

              {/* Stage jumps for when the conversation actually moves. */}
              {open === it.artistId && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    ["IN_TALKS", "They replied"],
                    ["INVITED", "Sent claim link"],
                    ["ARCHIVED", "Not interested"],
                  ].map(([stage, label]) => (
                    <form key={stage} action={logOutreachTouch.bind(null, it.artistId, stage)}>
                      <button className="rounded border border-edge px-2.5 py-1 tag text-smoke hover:text-white">
                        {label}
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

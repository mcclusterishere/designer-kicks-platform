"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LESSONS, type LessonValues } from "@/lib/marketLessons";

/**
 * The lesson, on the number.
 *
 * Deliberately quiet: a small mark beside a column heading that most people
 * will scroll straight past. The market has to stay a market — a dense
 * table of real prices — and only open up for the person who stops and
 * wonders what "spread" means. A tutorial that interrupts everyone teaches
 * nobody, because they learn to dismiss it.
 *
 * What makes it land is that it answers using the numbers already on
 * screen. Not "a spread is the difference between bid and ask" in the
 * abstract, but "this pair's spread is $84, 12% of mid, and that's wide."
 */
export default function Explain({
  lesson: lessonId,
  values,
  label,
}: {
  lesson: string;
  values?: LessonValues;
  /** Optional visible trigger text. Without it, just the mark. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const lesson = LESSONS[lessonId];
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // The sheet covers the page on a phone; don't let the market scroll
    // underneath it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!lesson) return null;

  const figure = values && lesson.figure ? lesson.figure(values) : null;

  /**
   * The sheet goes to document.body, not where the trigger sits.
   *
   * Two reasons, both discovered the hard way. The triggers live inside
   * elements carrying .tag — uppercase, mono, 0.2em tracking — and CSS
   * inheritance doesn't care that the sheet is position:fixed, so two
   * paragraphs of prose rendered in all-caps letterspaced monospace.
   * Unreadable, and exactly the opposite of the point. The second reason is
   * that a modal nested inside a <table> wrapped in overflow-x:auto is a
   * clipping and stacking hazard regardless of z-index.
   */
  const sheet = open ? (
    <div
      className="scrim fixed inset-0 z-[120] flex items-end justify-center p-0 normal-case tracking-normal backdrop-blur-sm sm:items-center sm:p-5"
      style={{ fontFamily: "var(--font-sans)", fontSize: "1rem", letterSpacing: "normal" }}
      onClick={() => setOpen(false)}
    >
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${panelId}-title`}
            onClick={(e) => e.stopPropagation()}
            className="sheet-rise max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-edge bg-surface p-5 shadow-[0_-8px_60px_rgba(0,0,0,0.5)] sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="tag text-heat">On the desk this is called</p>
                <h2 id={`${panelId}-title`} className="display mt-0.5 text-2xl text-white">
                  {lesson.street}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="shrink-0 rounded-lg border border-edge px-3 py-1.5 tag text-smoke transition hover:border-volt hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-volt"
              >
                Close
              </button>
            </div>

            {/* The concept. */}
            <div className="mt-4 space-y-2.5">
              {lesson.what.map((p, i) => (
                <p key={i} className="article-body text-sm leading-relaxed">
                  {p}
                </p>
              ))}
            </div>

            {/* The same idea in this pair's actual numbers — the part that
                makes it stick, and the reason this lives on the market
                rather than in a course. */}
            {figure && (
              <div className="mt-4 rounded-xl border border-volt/40 bg-volt/5 p-3.5">
                <p className="tag text-volt">Right here, right now</p>
                <p className="mt-1 text-sm leading-relaxed text-white">{figure}</p>
              </div>
            )}

            {lesson.elsewhere && (
              <div className="mt-3 rounded-xl border border-edge bg-panel p-3.5">
                <p className="tag text-smoke">Same thing, bigger market</p>
                <p className="mt-1 text-sm leading-relaxed text-smoke">{lesson.elsewhere}</p>
              </div>
            )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`What does ${lesson.label} mean?`}
        className="ml-1 inline-flex items-center gap-1 align-middle text-smoke transition hover:text-volt focus:text-volt focus:outline-none focus-visible:ring-1 focus-visible:ring-volt"
      >
        {label && <span className="underline decoration-dotted underline-offset-2">{label}</span>}
        <span
          aria-hidden
          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-current text-[9px] font-bold leading-none"
        >
          ?
        </span>
      </button>
      {sheet && createPortal(sheet, document.body)}
    </>
  );
}

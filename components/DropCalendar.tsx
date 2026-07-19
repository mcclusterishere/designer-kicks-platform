"use client";

// The tappable half of /drops: a month grid where any day with a drop
// opens a bottom sheet — the drop list for that date with the story
// (explanation + history) and raffle links. Pure client state, no deps.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Countdown from "@/components/Countdown";

export type DayDrop = {
  slug: string; // unique key; article slug for editorial drops
  name: string;
  excerpt: string;
  cover: string | null;
  // ISO timestamp of the drop — countdowns and calendar exports.
  dropAtISO: string | null;
  // Raffle first (if any), then the merchants that pay commission —
  // every href already routed through /go for tagging + click receipts.
  links: { label: string; href: string }[];
  // Artist-announced drops override these: they link to the artist page
  // (not /news), carry a badge, and have no per-article .ics.
  href?: string; // primary "story" link (default /news/<slug>)
  linkLabel?: string; // default "The story + history →"
  badge?: string | null; // e.g. "Artist drop"
  hasIcs?: boolean; // false for artist drops (no article to export)
};

/** All-day Google Calendar template link for a drop. */
function gcalHref(name: string, iso: string, storyPath: string): string {
  const d = new Date(iso);
  const ymd = (x: Date) =>
    `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, "0")}${String(x.getUTCDate()).padStart(2, "0")}`;
  const next = new Date(d.getTime() + 24 * 3600 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${name} — drop day`,
    dates: `${ymd(d)}/${ymd(next)}`,
    details: `Details: ${typeof location !== "undefined" ? location.origin : ""}${storyPath}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function DropCalendar({
  monthTitle,
  year,
  month0,
  daysInMonth,
  leadingBlanks,
  dropDays,
}: {
  monthTitle: string; // "July 2026"
  year: number;
  month0: number; // 0-based month
  daysInMonth: number;
  leadingBlanks: number;
  dropDays: Record<number, DayDrop[]>;
}) {
  const [openDay, setOpenDay] = useState<number | null>(null);
  // Focus management for the bottom sheet: remember what opened it so
  // focus returns there on close, and the sheet's close button to move
  // focus in on open.
  const openerRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  function openSheet(day: number, e: React.MouseEvent<HTMLButtonElement>) {
    openerRef.current = e.currentTarget;
    setOpenDay(day);
  }
  function closeSheet() {
    setOpenDay(null);
    openerRef.current?.focus();
  }
  // "Today" in the VIEWER'S timezone, not the server's — computed on
  // the client so the gold ring always matches the reader's clock.
  const [todayDay, setTodayDay] = useState<number | null>(null);
  const [tz, setTz] = useState<string | null>(null);
  useEffect(() => {
    const now = new Date();
    setTodayDay(now.getFullYear() === year && now.getMonth() === month0 ? now.getDate() : null);
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " "));
    } catch {}
  }, [year, month0]);
  const monthName = monthTitle.split(" ")[0];
  const drops = openDay !== null ? (dropDays[openDay] ?? []) : [];

  // While the sheet is up: Esc closes, the page behind stays put, focus
  // moves into the sheet, and Tab is trapped within it.
  useEffect(() => {
    if (openDay === null) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenDay(null);
        openerRef.current?.focus();
        return;
      }
      if (e.key === "Tab" && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openDay]);

  return (
    <>
      {tz && (
        <p className="tag mt-4 text-center text-smoke/50">Your time · {tz}</p>
      )}
      <div className="mt-2 grid grid-cols-7 text-center">
        {WEEKDAYS.map((w, i) => (
          <p key={`${w}${i}`} className="tag pb-2 text-smoke">
            {w}
          </p>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = i + 1;
          const dayDrops = dropDays[d];
          const circle = (
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm tabular transition group-hover:scale-110 group-active:scale-95 ${
                todayDay === d
                  ? "bg-volt font-bold text-ink"
                  : dayDrops
                    ? "border border-volt/60 text-white group-hover:border-volt"
                    : "text-smoke/80"
              }`}
            >
              {d}
            </span>
          );
          return dayDrops ? (
            <button
              key={d}
              type="button"
              onClick={(e) => openSheet(d, e)}
              aria-haspopup="dialog"
              aria-label={`${monthName} ${d} — ${dayDrops.length} ${dayDrops.length === 1 ? "drop" : "drops"}`}
              className="group flex min-h-14 cursor-pointer flex-col items-center gap-1 py-1.5"
            >
              {circle}
              <span className="h-1.5 w-1.5 rounded-full bg-heat" />
            </button>
          ) : (
            <div key={d} className="flex min-h-14 flex-col items-center gap-1 py-1.5">
              {circle}
            </div>
          );
        })}
      </div>

      {openDay !== null && (
        <div
          className="fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label={`Drops on ${monthName} ${openDay}`}
        >
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Close"
            onClick={closeSheet}
            className="absolute inset-0 w-full animate-[sheet-fade_.2s_ease-out] bg-ink/70 backdrop-blur-[2px]"
          />
          <div ref={sheetRef} className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl animate-[sheet-up_.28s_cubic-bezier(.32,.72,0,1)] rounded-t-3xl border-x border-t border-edge bg-panel px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
            <div className="mx-auto h-1 w-10 rounded-full bg-edge" aria-hidden />
            <div className="mt-3 flex items-baseline justify-between">
              <p className="display text-2xl text-white">
                {monthName} {openDay}
              </p>
              <p className="tag text-smoke">
                {drops.length === 1 ? "1 drop" : `${drops.length} drops`}
              </p>
            </div>
            <div className="mt-1 max-h-[60vh] overflow-y-auto">
              {drops.map((dp) => (
                <div key={dp.slug} className="border-t border-edge/60 py-4 first:border-t-0 first:pt-3">
                  <div className="flex items-center gap-3">
                    {dp.cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={dp.cover}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-xl border border-edge object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white">
                        {dp.name}
                        {dp.badge && (
                          <span className="ml-2 rounded bg-volt/15 px-1.5 py-0.5 align-middle tag text-volt">
                            {dp.badge}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-smoke">
                        {dp.excerpt}
                      </p>
                    </div>
                  </div>
                  {dp.dropAtISO && new Date(dp.dropAtISO).getTime() > Date.now() && (
                    <p className="mt-2 text-sm text-heat">
                      Drops in <Countdown endsAt={dp.dropAtISO} />
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    <Link
                      href={dp.href ?? `/news/${dp.slug}`}
                      className="tag text-volt underline underline-offset-4"
                    >
                      {dp.linkLabel ?? "The story + history →"}
                    </Link>
                    {dp.dropAtISO && (
                      <>
                        <a
                          href={gcalHref(dp.name, dp.dropAtISO, dp.href ?? `/news/${dp.slug}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tag text-smoke underline underline-offset-4 hover:text-white"
                        >
                          Google Cal
                        </a>
                        {dp.hasIcs !== false && (
                          <a
                            href={`/api/drop-ics/${dp.slug}`}
                            className="tag text-smoke underline underline-offset-4 hover:text-white"
                          >
                            .ics
                          </a>
                        )}
                      </>
                    )}
                  </div>
                  {dp.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {dp.links.map((l, i) => (
                        <a
                          key={l.label}
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer nofollow sponsored"
                          className={`tag rounded-full border px-2.5 py-1 transition ${
                            i === 0
                              ? "border-heat/60 text-heat hover:border-heat"
                              : "border-edge text-smoke hover:border-volt hover:text-white"
                          }`}
                        >
                          {l.label} ↗
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <p className="tag border-t border-edge/60 py-3 text-smoke">
                Some buy links pay the league a commission — never costs you extra.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

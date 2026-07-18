"use client";

// The tappable half of /drops: a month grid where any day with a drop
// opens a bottom sheet — the drop list for that date with the story
// (explanation + history) and raffle links. Pure client state, no deps.
import { useEffect, useState } from "react";
import Link from "next/link";

export type DayDrop = {
  slug: string;
  name: string;
  excerpt: string;
  raffleHref: string | null;
  cover: string | null;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function DropCalendar({
  monthTitle,
  daysInMonth,
  leadingBlanks,
  todayDay,
  dropDays,
}: {
  monthTitle: string; // "July 2026"
  daysInMonth: number;
  leadingBlanks: number;
  todayDay: number | null;
  dropDays: Record<number, DayDrop[]>;
}) {
  const [openDay, setOpenDay] = useState<number | null>(null);
  const monthName = monthTitle.split(" ")[0];
  const drops = openDay !== null ? (dropDays[openDay] ?? []) : [];

  // While the sheet is up: Esc closes, the page behind stays put.
  useEffect(() => {
    if (openDay === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenDay(null);
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
      <div className="mt-5 grid grid-cols-7 text-center">
        {WEEKDAYS.map((w, i) => (
          <p key={`${w}${i}`} className="tag pb-2 text-smoke/70">
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
              onClick={() => setOpenDay(d)}
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
            type="button"
            aria-label="Close"
            onClick={() => setOpenDay(null)}
            className="absolute inset-0 w-full animate-[sheet-fade_.2s_ease-out] bg-ink/70 backdrop-blur-[2px]"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl animate-[sheet-up_.28s_cubic-bezier(.32,.72,0,1)] rounded-t-3xl border-x border-t border-edge bg-panel px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
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
                      <p className="font-bold text-white">{dp.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-smoke">
                        {dp.excerpt}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-5">
                    <Link
                      href={`/news/${dp.slug}`}
                      className="tag text-volt underline underline-offset-4"
                    >
                      The story + history →
                    </Link>
                    {dp.raffleHref && (
                      <a
                        href={dp.raffleHref}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="tag text-heat underline underline-offset-4"
                      >
                        Raffle ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

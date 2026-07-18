import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Sneaker Drop Calendar — Release Dates & Raffle Links, Free | The Heat Chart",
  description:
    "Every upcoming sneaker release date and raffle link in one free calendar. No subscription, no paywall — drop intel is free on The Heat Chart.",
};
export const dynamic = "force-dynamic";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** "Air Jordan 9 OG 'Space Jam' — Release Date…" → "Air Jordan 9 OG 'Space Jam'" */
function dropName(title: string): string {
  return title.split(/[—:|]/)[0].trim();
}

function monthLabel(y: number, m: number): string {
  return new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function DropsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const now = new Date();
  const parsed = m?.match(/^(\d{4})-(\d{2})$/);
  const year = parsed ? Number(parsed[1]) : now.getUTCFullYear();
  const month = parsed ? Number(parsed[2]) - 1 : now.getUTCMonth();

  const monthStart = new Date(Date.UTC(year, month, 1));
  const nextStart = new Date(Date.UTC(year, month + 1, 1));
  const prevStart = new Date(Date.UTC(year, month - 1, 1));

  const [monthDrops, nextUp] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", dropAt: { gte: monthStart, lt: nextStart } },
      orderBy: { dropAt: "asc" },
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED", dropAt: { gte: new Date(now.getTime() - 86400000) } },
      orderBy: { dropAt: "asc" },
      take: 5,
    }),
  ]);

  const byDay = new Map<number, typeof monthDrops>();
  for (const a of monthDrops) {
    const d = a.dropAt!.getUTCDate();
    byDay.set(d, [...(byDay.get(d) ?? []), a]);
  }

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlanks = monthStart.getUTCDay();
  const isToday = (d: number) =>
    year === now.getUTCFullYear() && month === now.getUTCMonth() && d === now.getUTCDate();
  const mParam = (dte: Date) =>
    `${dte.getUTCFullYear()}-${String(dte.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="display text-4xl text-white">Drops</h1>
      <p className="mt-1 text-sm text-smoke">
        Every date + raffle link. <span className="text-white">Free forever.</span>
      </p>

      {/* Month switcher */}
      <div className="mt-8 flex items-center justify-between">
        <Link
          href={`/drops?m=${mParam(prevStart)}`}
          aria-label="Previous month"
          className="rounded-full border border-edge px-4 py-2 text-smoke transition hover:border-volt hover:text-white"
        >
          ‹
        </Link>
        <h2 className="display text-2xl text-white">{monthLabel(year, month)}</h2>
        <Link
          href={`/drops?m=${mParam(nextStart)}`}
          aria-label="Next month"
          className="rounded-full border border-edge px-4 py-2 text-smoke transition hover:border-volt hover:text-white"
        >
          ›
        </Link>
      </div>

      {/* The calendar */}
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
          const drops = byDay.get(d);
          return (
            <div key={d} className="flex min-h-14 flex-col items-center gap-1 py-1.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm tabular ${
                  isToday(d)
                    ? "bg-volt font-bold text-ink"
                    : drops
                      ? "border border-volt/60 text-white"
                      : "text-smoke/80"
                }`}
              >
                {d}
              </span>
              {drops && <span className="h-1.5 w-1.5 rounded-full bg-heat" />}
            </div>
          );
        })}
      </div>

      {/* This month's drops — the readable half of the calendar */}
      <div className="mt-6 border-t border-edge">
        {monthDrops.length === 0 ? (
          <p className="py-8 text-center text-sm text-smoke">No drops this month.</p>
        ) : (
          monthDrops.map((a) => (
            <div key={a.id} className="flex items-center gap-4 border-b border-edge py-3.5">
              <span className="display w-10 shrink-0 text-center text-2xl text-volt tabular">
                {a.dropAt!.getUTCDate()}
              </span>
              <Link
                href={`/news/${a.slug}`}
                className="min-w-0 flex-1 truncate text-white transition hover:text-volt"
              >
                {dropName(a.title)}
              </Link>
              {a.raffleUrl && (
                <a
                  href={a.raffleUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="tag shrink-0 text-volt underline underline-offset-4"
                >
                  Raffle ↗
                </a>
              )}
            </div>
          ))
        )}
      </div>

      {/* Next up, regardless of month */}
      {nextUp.length > 0 && (
        <div className="mt-10">
          <p className="tag text-smoke">Next up</p>
          <div className="mt-2">
            {nextUp.map((a) => (
              <div key={a.id} className="flex items-center gap-4 border-b border-edge/60 py-3">
                <span className="tag w-16 shrink-0 text-heat">
                  {a.dropAt!.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                <Link
                  href={`/news/${a.slug}`}
                  className="min-w-0 flex-1 truncate text-sm text-white transition hover:text-volt"
                >
                  {dropName(a.title)}
                </Link>
                {a.raffleUrl && (
                  <a
                    href={a.raffleUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="tag shrink-0 text-volt underline underline-offset-4"
                  >
                    Raffle ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-smoke/70">
        Dates move — check the{" "}
        <Link href="/news" className="underline">
          story
        </Link>{" "}
        before you camp.
      </p>
    </div>
  );
}

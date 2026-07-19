import Link from "next/link";
import { prisma } from "@/lib/db";
import { buyLinks, goHref } from "@/lib/affiliates";
import { DropCalendar, type DayDrop } from "@/components/DropCalendar";

export const metadata = {
  title: "Sneaker Drop Calendar — Release Dates & Raffle Links, Free | The Heat Chart",
  description:
    "Every upcoming sneaker release date and raffle link in one free calendar. No subscription, no paywall — drop intel is free on The Heat Chart.",
};
export const dynamic = "force-dynamic";

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

  const artistDropInclude = { artist: { select: { slug: true, displayName: true } } };
  const [monthDrops, nextUp, monthArtistDrops, nextUpArtist] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", dropAt: { gte: monthStart, lt: nextStart } },
      orderBy: { dropAt: "asc" },
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED", dropAt: { gte: new Date(now.getTime() - 86400000) } },
      orderBy: { dropAt: "asc" },
      take: 5,
    }),
    // Customizer-announced drops, once an admin has approved them.
    prisma.artistDrop.findMany({
      where: { status: "APPROVED", dropAt: { gte: monthStart, lt: nextStart } },
      orderBy: { dropAt: "asc" },
      include: artistDropInclude,
    }),
    prisma.artistDrop.findMany({
      where: { status: "APPROVED", dropAt: { gte: new Date(now.getTime() - 86400000) } },
      orderBy: { dropAt: "asc" },
      take: 5,
      include: artistDropInclude,
    }),
  ]);

  // Day → tap-sheet payload for the interactive grid.
  const dropDays: Record<number, DayDrop[]> = {};
  for (const a of monthDrops) {
    const d = a.dropAt!.getUTCDate();
    (dropDays[d] ??= []).push({
      slug: a.slug,
      name: dropName(a.title),
      excerpt: a.excerpt,
      cover: a.coverImage ?? null,
      dropAtISO: a.dropAt!.toISOString(),
      links: buyLinks(dropName(a.title), a.raffleUrl, "drops"),
    });
  }
  for (const ad of monthArtistDrops) {
    const d = ad.dropAt.getUTCDate();
    (dropDays[d] ??= []).push({
      slug: `artist-${ad.id}`,
      name: ad.title,
      excerpt: ad.description ?? `A custom drop from ${ad.artist.displayName}.`,
      cover: ad.imageUrl ?? null,
      dropAtISO: ad.dropAt.toISOString(),
      links: ad.buyUrl ? [{ label: "Cop / details", href: goHref(ad.buyUrl, "drops") }] : [],
      href: ad.artist.slug ? `/artists/${ad.artist.slug}` : "/artists",
      linkLabel: `${ad.artist.displayName} →`,
      badge: "Artist drop",
      hasIcs: false,
    });
  }

  // Unified, date-sorted rows for the readable list + "Next up".
  type Row = {
    id: string;
    date: Date;
    name: string;
    href: string;
    action: { label: string; href: string } | null;
    artist: boolean;
  };
  const toArticleRow = (a: (typeof monthDrops)[number]): Row => ({
    id: a.id,
    date: a.dropAt!,
    name: dropName(a.title),
    href: `/news/${a.slug}`,
    action: a.raffleUrl ? { label: "Raffle ↗", href: goHref(a.raffleUrl, "drops") } : null,
    artist: false,
  });
  const toArtistRow = (ad: (typeof monthArtistDrops)[number]): Row => ({
    id: ad.id,
    date: ad.dropAt,
    name: ad.title,
    href: ad.artist.slug ? `/artists/${ad.artist.slug}` : "/artists",
    action: ad.buyUrl ? { label: "Cop ↗", href: goHref(ad.buyUrl, "drops") } : null,
    artist: true,
  });
  const byDate = (a: Row, b: Row) => a.date.getTime() - b.date.getTime();
  const monthRows: Row[] = [...monthDrops.map(toArticleRow), ...monthArtistDrops.map(toArtistRow)].sort(byDate);
  const nextRows: Row[] = [...nextUp.map(toArticleRow), ...nextUpArtist.map(toArtistRow)].sort(byDate).slice(0, 6);

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlanks = monthStart.getUTCDay();
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

      {/* The calendar — tap any marked day for that date's drop sheet */}
      <DropCalendar
        monthTitle={monthLabel(year, month)}
        year={year}
        month0={month}
        daysInMonth={daysInMonth}
        leadingBlanks={leadingBlanks}
        dropDays={dropDays}
      />

      {/* This month's drops — the readable half of the calendar */}
      <div className="mt-6 border-t border-edge">
        {monthRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-smoke">No drops this month.</p>
        ) : (
          monthRows.map((r) => (
            <div key={r.id} className="flex items-center gap-4 border-b border-edge py-3.5">
              <span className="display w-10 shrink-0 text-center text-2xl text-volt tabular">
                {r.date.getUTCDate()}
              </span>
              <Link
                href={r.href}
                className="min-w-0 flex-1 truncate text-white transition hover:text-volt"
              >
                {r.name}
                {r.artist && <span className="tag ml-2 text-volt">· Artist</span>}
              </Link>
              {r.action && (
                <a
                  href={r.action.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="tag shrink-0 text-volt underline underline-offset-4"
                >
                  {r.action.label}
                </a>
              )}
            </div>
          ))
        )}
      </div>

      {/* Next up, regardless of month */}
      {nextRows.length > 0 && (
        <div className="mt-10">
          <p className="tag text-smoke">Next up</p>
          <div className="mt-2">
            {nextRows.map((r) => (
              <div key={r.id} className="flex items-center gap-4 border-b border-edge/60 py-3">
                <span className="tag w-16 shrink-0 text-heat">
                  {r.date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                <Link
                  href={r.href}
                  className="min-w-0 flex-1 truncate text-sm text-white transition hover:text-volt"
                >
                  {r.name}
                  {r.artist && <span className="tag ml-2 text-volt">· Artist</span>}
                </Link>
                {r.action && (
                  <a
                    href={r.action.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="tag shrink-0 text-volt underline underline-offset-4"
                  >
                    {r.action.label}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The feature paid calendars charge for — subscribe once, every
          drop lands in your own calendar app forever. */}
      <div className="mt-8 rounded-2xl border border-edge bg-surface p-4 text-center">
        <p className="tag text-volt">Never miss a drop</p>
        <p className="mt-1 text-sm text-smoke">
          Subscribe once — every release (and every date change) lands
          in your calendar app automatically. No paywall, ever.
        </p>
        <a
          href="/api/drops-ics"
          className="btn-hard mt-3 inline-block rounded-xl px-6 py-2.5 tag font-bold"
        >
          Add All Drops To My Calendar
        </a>
      </div>

      <p className="mt-6 text-center text-xs text-smoke/70">
        Dates move — check the{" "}
        <Link href="/news" className="underline">
          story
        </Link>{" "}
        before you camp.
      </p>
    </div>
  );
}

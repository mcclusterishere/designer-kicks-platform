import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Sneaker Drop Calendar — Release Dates & Raffle Links, Free | The Heat Chart",
  description:
    "Every upcoming sneaker release date and raffle link in one free calendar. No subscription, no paywall — drop intel is free on The Heat Chart.",
};
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

function dateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function DropsPage() {
  const now = new Date();
  const [upcoming, recent] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", dropAt: { gte: new Date(now.getTime() - DAY) } },
      orderBy: { dropAt: "asc" },
    }),
    prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        dropAt: { lt: new Date(now.getTime() - DAY), gte: new Date(now.getTime() - 14 * DAY) },
      },
      orderBy: { dropAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="tag text-heat">Release intel</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        The Drop Calendar
      </h1>
      <p className="mt-3 max-w-xl text-smoke">
        Every date and raffle link we&apos;re tracking, in one place.{" "}
        <span className="text-white">Free forever</span> — no subscription, no
        paywall, no app to buy. Full stories live in the{" "}
        <Link href="/news" className="text-volt underline">Drop Report</Link>.
      </p>

      {upcoming.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-edge bg-surface p-8 text-center text-smoke">
          Nothing on the calendar right now — the next drops land here the
          moment the newsroom confirms dates.
        </p>
      ) : (
        <div className="mt-8 space-y-3">
          {upcoming.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-edge bg-surface p-4 transition hover:border-volt/50"
            >
              <div className="w-24 shrink-0 rounded-lg border border-heat/50 bg-panel px-2 py-2 text-center">
                <p className="tag text-heat">{dateLabel(a.dropAt!)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/news/${a.slug}`} className="font-bold text-white hover:text-volt">
                  {a.title}
                </Link>
                <p className="mt-0.5 line-clamp-1 text-sm text-smoke">{a.excerpt}</p>
              </div>
              {a.raffleUrl && (
                <a
                  href={a.raffleUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="tag shrink-0 rounded-lg bg-volt px-4 py-2.5 font-bold text-ink transition hover:opacity-90"
                >
                  Enter / Cop ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <>
          <h2 className="display mt-12 text-2xl text-smoke">Just Dropped</h2>
          <div className="mt-4 space-y-2">
            {recent.map((a) => (
              <Link
                key={a.id}
                href={`/news/${a.slug}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface px-4 py-3 text-sm transition hover:border-volt/50"
              >
                <span className="min-w-0 truncate text-white">{a.title}</span>
                <span className="tag shrink-0 text-smoke">{dateLabel(a.dropAt!)}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="mt-10 rounded-xl border border-edge bg-surface p-4 text-xs text-smoke">
        Dates shift — brands move releases without notice, so re-check the
        linked story before you camp. Raffle links go to the retailer;
        entering is always on their site, never ours.
      </p>
    </div>
  );
}

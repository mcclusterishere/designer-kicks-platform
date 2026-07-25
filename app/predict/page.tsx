import Money from "@/components/Money";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/market";
import { getCallSlate, getTrackRecord, getCallerBoard } from "@/lib/predictions";
import CallBoard from "./CallBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Call — Predict Sneaker Resale, Build Your Track Record | The Heat Chart",
  description:
    "Call where a pair's resale lands in 7 or 30 days. Settled automatically against real recorded market prices — no opinions, just your record.",
  openGraph: {
    title: "The Call — Predict Sneaker Resale",
    description: "Read the market before it moves. Free to play, scored on real prices.",
    type: "website",
  },
};

export default async function PredictPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [slate, board, myCalls, record] = await Promise.all([
    getCallSlate(18),
    getCallerBoard(userId),
    userId
      ? prisma.prediction.findMany({
          where: { userId },
          orderBy: [{ status: "asc" }, { resolveAt: "asc" }],
          take: 20,
          include: { shoe: { select: { name: true, sku: true, imageUrl: true } } },
        })
      : Promise.resolve([]),
    userId ? getTrackRecord(userId) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <p className="tag text-heat">The Heat Chart · Prediction market</p>
      <h1 className="display mt-2 text-5xl text-white sm:text-6xl">THE CALL</h1>
      <p className="mt-3 max-w-2xl text-lg text-smoke">
        Say where a pair lands in 7 or 30 days. Every call is settled against the price we
        actually recorded when the window closes — nobody scores it by hand. Read the market
        better than the room and it shows up in your record.
      </p>

      {record && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Track record", v: record.accuracyPct === null ? "—" : `${record.accuracyPct}%` },
            { k: "Calls settled", v: String(record.settled) },
            { k: "Open now", v: String(record.open) },
            { k: "Points", v: String(record.points) },
          ].map((s) => (
            <div key={s.k} className="rounded-xl border border-edge bg-surface p-4">
              <p className="tag text-smoke">{s.k}</p>
              <p className="display mt-0.5 text-2xl text-heat">{s.v}</p>
            </div>
          ))}
        </div>
      )}

      {!userId && (
        <div className="mt-6 rounded-xl border border-edge bg-surface p-5">
          <p className="text-white">
            <Link href="/signin" className="text-volt underline">Sign in</Link> to make calls and
            build a track record. Free — you win on read, not on wallet.
          </p>
        </div>
      )}

      {userId && (
        <div className="mt-8">
          <h2 className="display text-2xl text-white">Make a call</h2>
          <p className="mt-1 text-sm text-smoke">Tap a pair, pick your window, call it.</p>
          <div className="mt-3">
            <CallBoard slate={slate} />
          </div>
        </div>
      )}

      {myCalls.length > 0 && (
        <div className="mt-10">
          <h2 className="display text-2xl text-white">Your calls</h2>
          <div className="mt-3 space-y-2">
            {myCalls.map((c) => {
              const settled = c.status === "SETTLED";
              const win = c.correct === true;
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border border-edge bg-panel p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.shoe.imageUrl || "/seed/news-1.svg"}
                    alt={c.shoe.name}
                    className="h-12 w-12 shrink-0 rounded bg-surface object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{c.shoe.name}</p>
                    <p className="tag text-smoke">
                      {c.kind === "DIRECTION"
                        ? `${c.direction === "UP" ? "▲ higher" : "▼ lower"} in ${c.horizonDays}d`
                        : `called ${formatUsd(c.predictedCents ?? 0)} in ${c.horizonDays}d`}
                      {" · from "}
                      <Money cents={c.basisCents} showUsd={false} />
                      {settled && c.actualCents ? ` · landed ${formatUsd(c.actualCents)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 tag font-bold ${
                      c.status === "VOID"
                        ? "text-smoke"
                        : settled
                          ? win ? "text-heat" : "text-volt"
                          : "text-smoke"
                    }`}
                  >
                    {c.status === "VOID"
                      ? "void"
                      : settled
                        ? win ? `+${c.points}` : "miss"
                        : `${Math.max(0, Math.ceil((c.resolveAt.getTime() - Date.now()) / 86400000))}d left`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="display text-2xl text-white">Sharpest callers</h2>
        <p className="mt-1 text-sm text-smoke">Minimum 3 settled calls — one lucky guess doesn&apos;t rank.</p>
        <div className="mt-3 overflow-hidden rounded-xl border border-edge">
          {board.length === 0 ? (
            <p className="bg-surface p-5 text-sm text-smoke">
              Nobody&apos;s completed enough calls yet. First settled week sets the bar.
            </p>
          ) : (
            board.map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between gap-3 border-b border-edge/60 px-4 py-2.5 last:border-0 ${r.you ? "bg-heat/10" : "bg-surface"}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-center tag ${i < 3 ? "text-heat" : "text-smoke"}`}>{i + 1}</span>
                  <span className={`text-sm ${r.you ? "font-bold text-white" : "text-white/90"}`}>
                    {r.name}{r.you ? " (you)" : ""}
                  </span>
                  <span className="tag text-smoke">{r.accuracyPct}% of {r.settled}</span>
                </div>
                <span className="tabular-nums text-sm font-bold text-white">{r.points}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-edge bg-surface p-5 text-sm text-smoke">
        <p className="tag text-heat">How it scores</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><span className="text-white">Up / Down</span> — 10 points for calling it right, <span className="text-white">doubled to 20</span> if you were on the minority side. Agreeing with the room is worth less than seeing what it missed.</li>
          <li><span className="text-white">Exact price</span> — up to 25 points, scaled by how close you land as a share of the real number.</li>
          <li>A flat market resolves against both sides — no points for noise.</li>
          <li>If the market never gave us a reading to settle against, the call is <span className="text-white">voided</span>, never guessed. A missing data point can&apos;t cost you your record.</li>
          <li>Winning calls pay Culture credits automatically.</li>
        </ul>
      </div>
    </div>
  );
}

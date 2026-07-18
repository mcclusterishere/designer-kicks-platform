import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getActiveGiveaway,
  getActiveRun,
  getCurrentQuestion,
  getStrikeState,
  getQuizLeaderboard,
  FREE_STRIKES_PER_DAY,
  HEAT_CHECK_TARGET,
  PACK_SIZE,
  type LeaderboardEntry,
} from "@/lib/quiz";
import { verifyCheckoutSession } from "@/app/quiz-actions";
import type { QuizState } from "@/app/quiz-actions";
import QuizGame from "./QuizGame";
import Countdown from "@/components/Countdown";

export const metadata = {
  title: "The Heat Check: Jordan Trivia — Win Rare Shoe Giveaways | The Heat Chart",
  description:
    "Answer 12 Jordan history questions to earn an entry into our rare shoe giveaway. 3 free strikes a day — how deep is your sneaker knowledge?",
};
export const dynamic = "force-dynamic";

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string; session_id?: string }>;
}) {
  const session = await auth();
  const { purchase, session_id } = await searchParams;

  // Credit the purchase on redirect if the webhook hasn't yet (idempotent).
  if (purchase === "success" && session_id) {
    await verifyCheckoutSession(session_id);
  }

  const [giveaway, questionCount, leaderboard] = await Promise.all([
    getActiveGiveaway(),
    prisma.quizQuestion.count({ where: { active: true } }),
    getQuizLeaderboard(10),
  ]);

  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Hero giveawayTitle={giveaway?.prize ?? null} />
        <div className="mt-8 rounded-xl border border-volt/50 bg-surface p-8 text-center glow-volt">
          <p className="display text-2xl text-white">Sign in to play</p>
          <p className="mt-2 text-smoke">
            Your entries, strikes, and credits live on your account.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/signin" className="rounded-lg bg-volt px-6 py-3 tag font-bold text-ink">
              Sign In
            </Link>
            <Link href="/register" className="rounded-lg border border-edge px-6 py-3 tag text-white hover:border-volt">
              Create Account
            </Link>
          </div>
        </div>
        <Leaderboard entries={leaderboard} />
        <Rules />
      </div>
    );
  }

  const userId = session.user.id;
  const [run, strikes] = await Promise.all([getActiveRun(userId), getStrikeState(userId)]);
  const question = run ? await getCurrentQuestion(run) : null;

  const initialState: QuizState | null = run
    ? {
        runId: run.id,
        status: run.status as QuizState["status"],
        correctCount: run.correctCount,
        wrongCount: run.wrongCount,
        usedPaidStrikes: run.usedPaidStrikes,
        target: HEAT_CHECK_TARGET,
        strikes,
        question,
      }
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Hero giveawayTitle={giveaway?.prize ?? null} />

      {giveaway && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-heat/50 bg-surface p-4">
          <div>
            <p className="tag text-heat">Current giveaway</p>
            <p className="font-bold text-white">{giveaway.prize}</p>
            <p className="text-xs text-smoke">
              {giveaway._count.entries} entries · ends in{" "}
              <Countdown endsAt={giveaway.endsAt.toISOString()} />
            </p>
          </div>
          <Link href="/giveaway" className="tag text-volt underline">
            Details →
          </Link>
        </div>
      )}

      <div className="mt-6">
        <QuizGame
          initialState={initialState}
          purchaseResult={purchase ?? null}
          stripeConfigured={Boolean(process.env.STRIPE_SECRET_KEY)}
          purchasesEnabled={
            Boolean(process.env.STRIPE_SECRET_KEY) ||
            process.env.NODE_ENV !== "production" ||
            process.env.PAYMENTS_DEV_MODE === "true"
          }
          questionCount={questionCount}
        />
      </div>

      <Leaderboard entries={leaderboard} />
      <Rules />
    </div>
  );
}

function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="display text-2xl text-white">
        Heat Check <span className="text-volt">Leaderboard</span>
      </h2>
      <p className="mt-1 text-sm text-smoke">
        All-time checks passed, then accuracy. Paid runs count here — this
        is for bragging rights, not giveaway odds.
      </p>
      <ol className="mt-4 space-y-2">
        {entries.map((e, i) => (
          <li
            key={e.userId}
            className={`flex items-center gap-3 rounded-lg border bg-surface px-4 py-2.5 ${
              i === 0 ? "border-volt" : "border-edge"
            }`}
          >
            <span className={`display w-8 text-center text-xl ${i < 3 ? "text-volt" : "text-smoke"}`}>
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-white">
                {e.name}{" "}
                {e.badges.map((b) => (
                  <span key={b.key} title={`${b.label} — ${b.description}`}>{b.emoji}</span>
                ))}
              </p>
              <p className="tag text-smoke">
                {e.answered} answered · {e.accuracy}% accuracy
              </p>
            </div>
            <p className="display shrink-0 text-xl text-white">
              {e.wins}
              <span className="tag ml-1 text-smoke">passed</span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Hero({ giveawayTitle }: { giveawayTitle: string | null }) {
  return (
    <div>
      <p className="tag text-heat">Jordan trivia</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        The Heat Check
      </h1>
      <p className="mt-3 text-smoke">
        {HEAT_CHECK_TARGET} correct answers on Jordan history and release details
        wins you an entry into the{" "}
        {giveawayTitle ? (
          <span className="text-white">{giveawayTitle}</span>
        ) : (
          "rare shoe"
        )}{" "}
        giveaway. Wrong answers cost strikes — you get {FREE_STRIKES_PER_DAY}{" "}
        free a day.
      </p>
    </div>
  );
}

function Rules() {
  return (
    <div className="mt-10 rounded-xl border border-edge bg-surface p-5 text-sm text-smoke">
      <p className="tag text-volt">How it works</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Hit {HEAT_CHECK_TARGET} correct answers in a run to pass the Heat Check.</li>
        <li>Wrong answers cost a strike and skip to the next question.</li>
        <li>{FREE_STRIKES_PER_DAY} free strikes every day — resets at midnight UTC.</li>
        <li>
          <strong className="text-white">Giveaway entries come only from runs completed on free
          strikes.</strong> Every free-strike pass earns an entry.
        </li>
        <li>
          Need more strikes? $1 gets you a pack of {PACK_SIZE}. Purchased
          strikes keep your run alive for the <strong className="text-white">leaderboard and
          badges</strong> — they never earn entries or affect giveaway odds.
        </li>
      </ul>
      <p className="mt-4 border-t border-edge pt-3 text-xs">
        <strong>No purchase necessary to enter — and purchases never improve
        your odds.</strong> Free daily strikes provide the only path to
        entries, every day. Must be 18+. Giveaway void where prohibited —
        see the{" "}
        <Link href="/giveaway" className="underline">giveaway page</Link> for
        official rules.
      </p>
    </div>
  );
}

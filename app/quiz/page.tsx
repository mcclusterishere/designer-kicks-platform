import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getActiveGiveaway,
  getActiveRun,
  getCurrentQuestion,
  getStrikeState,
  FREE_STRIKES_PER_DAY,
  HEAT_CHECK_TARGET,
  PACK_SIZE,
} from "@/lib/quiz";
import { verifyCheckoutSession } from "@/app/quiz-actions";
import type { QuizState } from "@/app/quiz-actions";
import QuizGame from "./QuizGame";
import Countdown from "@/components/Countdown";

export const metadata = {
  title: "The Heat Check: Jordan Trivia — Win Rare Shoe Giveaways | Designer Kicks",
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

  const giveaway = await getActiveGiveaway();
  const questionCount = await prisma.quizQuestion.count({ where: { active: true } });

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
          questionCount={questionCount}
        />
      </div>

      <Rules />
    </div>
  );
}

function Hero({ giveawayTitle }: { giveawayTitle: string | null }) {
  return (
    <div>
      <p className="tag text-heat">Jordan trivia</p>
      <h1 className="display mt-2 text-4xl text-white sm:text-5xl">
        The Heat <span className="text-heat">Check</span>
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
        <li>Hit {HEAT_CHECK_TARGET} correct answers in a run to earn a giveaway entry.</li>
        <li>Wrong answers cost a strike and skip to the next question.</li>
        <li>{FREE_STRIKES_PER_DAY} free strikes every day — resets at midnight UTC.</li>
        <li>Need more strikes? $1 gets you a pack of {PACK_SIZE}. Unused ones roll over.</li>
        <li>Multiple entries allowed — every passed heat check counts.</li>
      </ul>
      <p className="mt-4 border-t border-edge pt-3 text-xs">
        <strong>No purchase necessary to enter.</strong> Free daily strikes
        provide a free path to entry every day. Must be 18+. Giveaway void
        where prohibited — see the{" "}
        <Link href="/giveaway" className="underline">giveaway page</Link> for
        official rules.
      </p>
    </div>
  );
}

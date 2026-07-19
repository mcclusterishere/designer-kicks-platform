"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import {
  consumeStrike,
  getActiveGiveaway,
  getActiveRun,
  getCurrentQuestion,
  getStrikeState,
  grantCredits,
  HEAT_CHECK_TARGET,
  RUN_QUEUE_SIZE,
  PACK_SIZE,
  PACK_PRICE_CENTS,
  type PublicQuestion,
  type StrikeState,
} from "@/lib/quiz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Stripe from "stripe";

export type QuizState = {
  runId: string;
  status: "ACTIVE" | "NEEDS_CREDITS" | "WON" | "OUT_OF_QUESTIONS";
  correctCount: number;
  wrongCount: number;
  usedPaidStrikes: boolean;
  target: number;
  strikes: StrikeState;
  question: PublicQuestion | null;
};

export type AnswerFeedback = {
  correct: boolean;
  correctAnswer: string;
  explanation: string | null;
  earnedEntry: boolean;
};

export type QuizActionResult =
  | { ok: true; state: QuizState; feedback?: AnswerFeedback }
  | { ok: false; error: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function buildState(
  userId: string,
  run: {
    id: string;
    status: string;
    correctCount: number;
    wrongCount: number;
    usedPaidStrikes: boolean;
    questionIds: string;
    currentIndex: number;
  }
): Promise<QuizState> {
  const [strikes, question] = await Promise.all([
    getStrikeState(userId),
    run.status === "ACTIVE" || run.status === "NEEDS_CREDITS"
      ? getCurrentQuestion(run)
      : null,
  ]);
  return {
    runId: run.id,
    status: run.status as QuizState["status"],
    correctCount: run.correctCount,
    wrongCount: run.wrongCount,
    usedPaidStrikes: run.usedPaidStrikes,
    target: HEAT_CHECK_TARGET,
    strikes,
    question,
  };
}

export async function startQuizRun(): Promise<QuizActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to play." };
  const userId = session.user.id;

  // Resume an in-flight run instead of letting people re-roll questions.
  const existing = await getActiveRun(userId);
  if (existing) return { ok: true, state: await buildState(userId, existing) };

  // The pool excludes every question this player has EVER answered —
  // in the feed or in past runs. Answered is answered; questions never
  // come back (that's the Culture IQ ledger rule).
  const [questions, burned] = await Promise.all([
    prisma.quizQuestion.findMany({
      where: { active: true },
      select: { id: true },
    }),
    prisma.quizAnswer.findMany({
      where: { userId },
      select: { questionId: true },
    }),
  ]);
  const burnedIds = new Set(burned.map((b) => b.questionId));
  const pool = questions.filter((q) => !burnedIds.has(q.id));
  if (pool.length < HEAT_CHECK_TARGET) {
    return {
      ok: false,
      error:
        burned.length > 0
          ? "You've answered nearly every question on the site — new ones land with every drop article. Check back after the next drop."
          : "The question bank is still being loaded — check back soon.",
    };
  }

  const picked = shuffle(pool.map((q) => q.id)).slice(0, RUN_QUEUE_SIZE);
  const run = await prisma.quizRun.create({
    data: { userId, questionIds: JSON.stringify(picked) },
  });
  return { ok: true, state: await buildState(userId, run) };
}

export async function answerQuestion(
  runId: string,
  questionId: string,
  optionIndex: number
): Promise<QuizActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to play." };
  const userId = session.user.id;

  const run = await prisma.quizRun.findUnique({ where: { id: runId } });
  if (!run || run.userId !== userId) return { ok: false, error: "Run not found." };
  if (run.status === "NEEDS_CREDITS") {
    return { ok: false, error: "You're out of strikes — grab a credit pack to keep going." };
  }
  if (run.status !== "ACTIVE") return { ok: false, error: "This run is over — start a new one." };

  const ids = JSON.parse(run.questionIds) as string[];
  const currentId = ids[run.currentIndex];
  // Guards double-submits and stale clients answering the wrong question.
  if (currentId !== questionId) {
    return { ok: true, state: await buildState(userId, run) };
  }

  const question = await prisma.quizQuestion.findUnique({ where: { id: currentId } });
  if (!question) return { ok: false, error: "Question missing — start a new run." };

  const options = JSON.parse(question.options) as string[];
  const correct = optionIndex === question.answerIndex;
  const correctAnswer = options[question.answerIndex];
  const outOfQuestions = run.currentIndex + 1 >= ids.length;

  if (correct) {
    const newCorrect = run.correctCount + 1;
    const won = newCorrect >= HEAT_CHECK_TARGET;
    // Atomically CLAIM this question's advance. The where-guard on
    // currentIndex + status means only ONE request (not a racing
    // forfeit or a double-tap) can process this question — the loser
    // gets count === 0 and does nothing. This is what stops a correct
    // answer being flipped to a miss, a WON run reverting to ACTIVE,
    // and a strike being burned twice.
    const claim = await prisma.quizRun.updateMany({
      where: { id: run.id, currentIndex: run.currentIndex, status: "ACTIVE" },
      data: {
        correctCount: newCorrect,
        currentIndex: run.currentIndex + 1,
        status: won ? "WON" : "ACTIVE",
        completedAt: won ? new Date() : null,
      },
    });
    if (claim.count === 0) {
      const fresh = await prisma.quizRun.findUnique({ where: { id: run.id } });
      return { ok: true, state: await buildState(userId, fresh ?? run) };
    }
    // We own the transition — record the ledger answer (a losing forfeit
    // never wrote its miss, so a correct answer wins the ledger too).
    try {
      await prisma.quizAnswer.create({
        data: { userId, questionId: question.id, correct: true, source: "gauntlet" },
      });
    } catch {
      // Already answered in the feed — never rescore.
    }
    let earnedEntry = false;
    if (won) {
      // Sweepstakes-law guard: giveaway entries come ONLY from runs
      // completed without purchased strikes.
      if (!run.usedPaidStrikes) {
        const giveaway = await getActiveGiveaway();
        if (giveaway) {
          await prisma.giveawayEntry.create({
            data: { giveawayId: giveaway.id, userId, source: "quiz" },
          });
          earnedEntry = true;
        }
      }
      revalidatePath("/giveaway");
      revalidatePath("/profile");
      revalidatePath("/quiz");
    }
    const updated = await prisma.quizRun.findUnique({ where: { id: run.id } });
    return {
      ok: true,
      state: await buildState(userId, updated ?? run),
      feedback: { correct: true, correctAnswer, explanation: question.explanation, earnedEntry },
    };
  }

  // Wrong answer. Claim the advance FIRST so only one request processes
  // it, THEN consume a strike — so a racing forfeit/double-tap can't
  // burn two strikes for one question.
  const claim = await prisma.quizRun.updateMany({
    where: { id: run.id, currentIndex: run.currentIndex, status: "ACTIVE" },
    data: { currentIndex: run.currentIndex + 1, wrongCount: run.wrongCount + 1 },
  });
  if (claim.count === 0) {
    const fresh = await prisma.quizRun.findUnique({ where: { id: run.id } });
    return {
      ok: true,
      state: await buildState(userId, fresh ?? run),
      feedback: { correct: false, correctAnswer, explanation: question.explanation, earnedEntry: false },
    };
  }
  try {
    await prisma.quizAnswer.create({
      data: { userId, questionId: question.id, correct: false, source: "gauntlet" },
    });
  } catch {}
  const strike = await consumeStrike(userId);
  const updated = await prisma.quizRun.update({
    where: { id: run.id },
    data: {
      usedPaidStrikes: run.usedPaidStrikes || strike === "paid",
      status: !strike ? "NEEDS_CREDITS" : outOfQuestions ? "OUT_OF_QUESTIONS" : "ACTIVE",
      completedAt: outOfQuestions && strike ? new Date() : null,
    },
  });

  return {
    ok: true,
    state: await buildState(userId, updated),
    feedback: { correct: false, correctAnswer, explanation: question.explanation, earnedEntry: false },
  };
}

/**
 * Anti-cheat: the player left the screen mid-question (tab hidden /
 * app backgrounded). Burn the current question as a miss — it lands in
 * the Culture IQ ledger so it NEVER returns, and it costs a strike
 * exactly like a wrong answer — then advance. Critically this returns
 * NO feedback: leaving to look up the answer reveals nothing and gains
 * nothing, because the question is already forfeited. Silent by design
 * (the client just moves to the next question) so cheaters can't learn
 * the rule and switch to a second device.
 */
export async function forfeitQuestion(
  runId: string,
  questionId: string
): Promise<QuizActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to play." };
  const userId = session.user.id;

  const run = await prisma.quizRun.findUnique({ where: { id: runId } });
  if (!run || run.userId !== userId) return { ok: false, error: "Run not found." };
  if (run.status !== "ACTIVE") return { ok: true, state: await buildState(userId, run) };

  const ids = JSON.parse(run.questionIds) as string[];
  const currentId = ids[run.currentIndex];
  // Stale/raced (they already answered): no-op, just report state.
  if (currentId !== questionId) {
    return { ok: true, state: await buildState(userId, run) };
  }

  // Claim the advance atomically. If the player actually answered this
  // question in the same instant (a legit answer beating the delayed
  // forfeit), that request wins the claim and this one does nothing —
  // so the answer is never overwritten with a miss and no strike is
  // double-burned.
  const claim = await prisma.quizRun.updateMany({
    where: { id: run.id, currentIndex: run.currentIndex, status: "ACTIVE" },
    data: { currentIndex: run.currentIndex + 1, wrongCount: run.wrongCount + 1 },
  });
  if (claim.count === 0) {
    const fresh = await prisma.quizRun.findUnique({ where: { id: run.id } });
    return { ok: true, state: await buildState(userId, fresh ?? run) };
  }
  // Burn it in the ledger — a miss, never returns, no reveal.
  try {
    await prisma.quizAnswer.create({
      data: { userId, questionId: currentId, correct: false, source: "gauntlet-forfeit" },
    });
  } catch {
    // Already answered elsewhere (feed) — never rescore.
  }
  const strike = await consumeStrike(userId);
  const outOfQuestions = run.currentIndex + 1 >= ids.length;
  const updated = await prisma.quizRun.update({
    where: { id: run.id },
    data: {
      usedPaidStrikes: run.usedPaidStrikes || strike === "paid",
      status: !strike ? "NEEDS_CREDITS" : outOfQuestions ? "OUT_OF_QUESTIONS" : "ACTIVE",
      completedAt: outOfQuestions && strike ? new Date() : null,
    },
  });
  // No feedback — the correct answer is never disclosed on a forfeit.
  return { ok: true, state: await buildState(userId, updated) };
}

/** After buying credits, unblock the stalled run and continue. */
export async function resumeRun(runId: string): Promise<QuizActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to play." };
  const userId = session.user.id;

  const run = await prisma.quizRun.findUnique({ where: { id: runId } });
  if (!run || run.userId !== userId) return { ok: false, error: "Run not found." };

  if (run.status === "NEEDS_CREDITS") {
    // The wrong answer that stalled this run hasn't been charged yet —
    // resuming spends that strike now. Free strikes are used first (a
    // midnight rollover can rescue the run for free), and a purchased
    // strike marks the run leaderboard-only.
    const strike = await consumeStrike(userId);
    if (!strike) {
      return { ok: false, error: "Still no strikes available — grab a credit pack first." };
    }
    // If the stall happened on the LAST question, there's nothing left to
    // resume into — the run is over, not active (avoids a stuck
    // "Loading question…" card).
    const ids = JSON.parse(run.questionIds) as string[];
    const done = run.currentIndex >= ids.length;
    const updated = await prisma.quizRun.update({
      where: { id: run.id },
      data: {
        status: done ? "OUT_OF_QUESTIONS" : "ACTIVE",
        completedAt: done ? new Date() : null,
        usedPaidStrikes: run.usedPaidStrikes || strike === "paid",
      },
    });
    return { ok: true, state: await buildState(userId, updated) };
  }
  return { ok: true, state: await buildState(userId, run) };
}

export async function abandonRun(runId: string): Promise<QuizActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to play." };

  const run = await prisma.quizRun.findUnique({ where: { id: runId } });
  if (run && run.userId === session.user.id && (run.status === "ACTIVE" || run.status === "NEEDS_CREDITS")) {
    await prisma.quizRun.update({
      where: { id: run.id },
      data: { status: "ABANDONED", completedAt: new Date() },
    });
  }
  return startQuizRun();
}

// ---------- Credit purchases ----------

export async function buyCreditPack(packs: number): Promise<{ ok: false; error: string } | { ok: true; dev: true } | never> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in first." };
  const userId = session.user.id;

  const qty = Math.min(10, Math.max(1, Math.floor(packs)));
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    const devGrantsAllowed =
      process.env.NODE_ENV !== "production" || process.env.PAYMENTS_DEV_MODE === "true";
    if (!devGrantsAllowed) {
      // Launched without Stripe: never grant free credits in public.
      return { ok: false, error: "Credit packs aren't on sale yet — your free strikes refill at midnight UTC." };
    }
    // Dev/test mode: no Stripe configured — grant instantly so the flow is testable.
    await grantCredits(userId, qty * PACK_SIZE, "purchase-dev");
    revalidatePath("/quiz");
    revalidatePath("/profile");
    return { ok: true, dev: true };
  }

  const stripe = new Stripe(stripeKey);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: qty,
        price_data: {
          currency: "usd",
          unit_amount: PACK_PRICE_CENTS,
          product_data: {
            name: `Quiz Credit Pack (${PACK_SIZE} extra strikes)`,
            description: "Extra wrong-answer strikes for the Heat Check trivia game on The Heat Chart.",
          },
        },
      },
    ],
    metadata: { userId, packs: String(qty) },
    success_url: `${base}/quiz?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/quiz?purchase=cancelled`,
  });

  redirect(checkout.url!);
}

/**
 * Fallback crediting on the success redirect (idempotent with the
 * webhook via the unique stripeSessionId) — covers local/dev setups
 * where webhooks aren't forwarded.
 */
export async function verifyCheckoutSession(sessionId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || !sessionId) return false;

  const stripe = new Stripe(stripeKey);
  const checkout = await stripe.checkout.sessions.retrieve(sessionId);
  if (checkout.payment_status !== "paid") return false;
  if (checkout.metadata?.userId !== session.user.id) return false;

  const already = await prisma.creditTransaction.findUnique({
    where: { stripeSessionId: sessionId },
  });
  if (already) return true;

  const packs = Number(checkout.metadata?.packs ?? 1);
  await grantCredits(session.user.id, packs * PACK_SIZE, "purchase", sessionId);
  revalidatePath("/quiz");
  return true;
}

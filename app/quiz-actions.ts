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
  toPublicQuestion,
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

  const questions = await prisma.quizQuestion.findMany({
    where: { active: true },
    select: { id: true },
  });
  if (questions.length < HEAT_CHECK_TARGET) {
    return { ok: false, error: "The question bank is still being loaded — check back soon." };
  }

  const picked = shuffle(questions.map((q) => q.id)).slice(0, RUN_QUEUE_SIZE);
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

  if (correct) {
    const newCorrect = run.correctCount + 1;
    const won = newCorrect >= HEAT_CHECK_TARGET;
    const updated = await prisma.quizRun.update({
      where: { id: run.id },
      data: {
        correctCount: newCorrect,
        currentIndex: run.currentIndex + 1,
        status: won ? "WON" : "ACTIVE",
        completedAt: won ? new Date() : null,
      },
    });

    let earnedEntry = false;
    if (won) {
      const giveaway = await getActiveGiveaway();
      if (giveaway) {
        await prisma.giveawayEntry.create({
          data: { giveawayId: giveaway.id, userId, source: "quiz" },
        });
        earnedEntry = true;
      }
      revalidatePath("/giveaway");
      revalidatePath("/profile");
    }

    return {
      ok: true,
      state: await buildState(userId, updated),
      feedback: { correct: true, correctAnswer, explanation: question.explanation, earnedEntry },
    };
  }

  // Wrong answer: costs a strike (free daily first, then purchased credits).
  const paid = await consumeStrike(userId);
  const outOfQuestions = run.currentIndex + 1 >= ids.length;
  const updated = await prisma.quizRun.update({
    where: { id: run.id },
    data: {
      wrongCount: run.wrongCount + 1,
      // Always advance so answers can't be brute-forced by retrying.
      currentIndex: run.currentIndex + 1,
      status: !paid ? "NEEDS_CREDITS" : outOfQuestions ? "OUT_OF_QUESTIONS" : "ACTIVE",
      completedAt: outOfQuestions && paid ? new Date() : null,
    },
  });

  return {
    ok: true,
    state: await buildState(userId, updated),
    feedback: { correct: false, correctAnswer, explanation: question.explanation, earnedEntry: false },
  };
}

/** After buying credits, unblock the stalled run and continue. */
export async function resumeRun(runId: string): Promise<QuizActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to play." };
  const userId = session.user.id;

  const run = await prisma.quizRun.findUnique({ where: { id: runId } });
  if (!run || run.userId !== userId) return { ok: false, error: "Run not found." };

  if (run.status === "NEEDS_CREDITS") {
    const strikes = await getStrikeState(userId);
    if (strikes.freeLeft + strikes.credits <= 0) {
      return { ok: false, error: "Still no strikes available — grab a credit pack first." };
    }
    const updated = await prisma.quizRun.update({
      where: { id: run.id },
      data: { status: "ACTIVE" },
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
    // Dev mode: no Stripe configured — grant instantly so the flow is testable.
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
            description: "Extra wrong-answer strikes for the Designer Kicks Heat Check trivia game.",
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

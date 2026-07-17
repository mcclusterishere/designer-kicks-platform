import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { logoutUser } from "@/app/account-actions";
import { computeBadges } from "@/lib/quiz";
import ProfileForm from "./ProfileForm";

export const metadata = { title: "Your Profile — Designer Kicks" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      _count: { select: { votes: true, giveawayEntries: true, quizRuns: true } },
    },
  });
  if (!user) redirect("/signin");

  const [wonRuns, quizAgg] = await Promise.all([
    prisma.quizRun.count({ where: { userId: user.id, status: "WON" } }),
    prisma.quizRun.aggregate({
      where: { userId: user.id },
      _sum: { correctCount: true, wrongCount: true },
    }),
  ]);
  const correct = quizAgg._sum.correctCount ?? 0;
  const answered = correct + (quizAgg._sum.wrongCount ?? 0);
  const badges = computeBadges({ wins: wonRuns, answered, correct });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="tag text-volt">Your account</p>
          <h1 className="display mt-2 text-4xl text-white">
            {user.name ?? "Sneakerhead"}
          </h1>
          <p className="mt-1 text-sm text-smoke">{user.email}</p>
        </div>
        <form action={logoutUser}>
          <button className="tag text-smoke hover:text-white">Sign out</button>
        </form>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Votes cast", value: user._count.votes },
          { label: "Quiz runs", value: user._count.quizRuns },
          { label: "Heat checks passed", value: wonRuns },
          { label: "Giveaway entries", value: user._count.giveawayEntries },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-edge bg-surface p-4 text-center">
            <p className="display text-3xl text-volt">{s.value}</p>
            <p className="tag mt-1 text-smoke">{s.label}</p>
          </div>
        ))}
      </div>

      {badges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((b) => (
            <span
              key={b.key}
              title={b.description}
              className="rounded-full border border-volt/40 bg-surface px-3 py-1.5 text-sm text-white"
            >
              {b.emoji} {b.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between rounded-xl border border-edge bg-surface p-4">
        <div>
          <p className="tag text-smoke">Quiz strike credits</p>
          <p className="display text-2xl text-white">{user.credits}</p>
        </div>
        <Link href="/quiz" className="rounded-lg bg-heat px-5 py-2.5 tag font-bold text-white">
          Take The Heat Check
        </Link>
      </div>

      <h2 className="display mt-10 text-2xl text-white">Your Info</h2>
      <p className="mt-1 text-sm text-smoke">
        Used for giveaway shipping and drop alerts — never shown publicly.
      </p>
      <div className="mt-4">
        <ProfileForm
          defaults={{
            name: user.name ?? "",
            phone: user.phone ?? "",
            city: user.city ?? "",
            shoeSize: user.shoeSize ?? "",
            favoriteSilhouette: user.favoriteSilhouette ?? "",
            favoriteBrands: user.favoriteBrands ?? "",
            styleInterests: user.styleInterests ?? "",
            instagram: user.instagram ?? "",
            marketingOptIn: user.marketingOptIn,
          }}
        />
      </div>
    </div>
  );
}

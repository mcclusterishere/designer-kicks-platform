import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getThread, markRead } from "@/lib/messages";
import MessageComposer from "@/components/MessageComposer";

export const dynamic = "force-dynamic";

/** One conversation. Oldest first, so it reads the way a conversation reads. */
export default async function ThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const { userId } = await params;

  const thread = await getThread(session.user.id, userId);
  // Null covers both "no such member" and "one of you blocked the other" —
  // deliberately indistinguishable, so a block can't be probed for.
  if (!thread) notFound();

  await markRead(session.user.id, userId);

  const { other, messages } = thread;
  const name = other.artistProfile?.displayName || other.name || "Member";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col px-4 py-8">
      <Link href="/messages" className="tag text-smoke hover:text-white">← Messages</Link>

      <div className="mt-3 flex items-center justify-between gap-3 border-b border-edge pb-3">
        <h1 className="display text-2xl text-white">{name}</h1>
        {other.artistProfile?.slug && (
          <Link
            href={`/artists/${other.artistProfile.slug}`}
            className="tag rounded-full border border-edge px-3 py-1.5 text-smoke hover:border-volt hover:text-white"
          >
            Their page →
          </Link>
        )}
      </div>

      <div className="mt-4 flex-1 space-y-2">
        {messages.length === 0 && (
          <p className="text-sm text-smoke">
            Nothing here yet. Say what you&apos;re after — base pair, size, budget, when you need it.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.fromUserId === session.user!.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  mine ? "bg-volt text-ink" : "border border-edge bg-surface text-white"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-ink/60" : "text-smoke"}`}>
                  {m.createdAt.toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-3 mt-4">
        <MessageComposer toUserId={other.id} toName={name} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getThreads } from "@/lib/messages";

export const metadata = { title: "Messages — The Heat Chart" };
export const dynamic = "force-dynamic";

/**
 * The inbox.
 *
 * This exists so a commission conversation can happen where there's a record
 * of it. Every one of these threads was previously an Instagram DM: no
 * history, no recourse, and nothing tying the deal to the artist's page.
 */
export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const threads = await getThreads(session.user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="tag text-volt">Direct</p>
      <h1 className="display mt-1 text-4xl text-white">Messages</h1>
      <p className="mt-2 text-sm text-smoke">
        Talk sizes, base pairs and budgets here — it stays on the record, on your
        account, instead of getting lost in a DM request folder.
      </p>

      {threads.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-edge bg-surface p-8 text-center">
          <p className="display text-xl text-white">No messages yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-smoke">
            Open any artist&apos;s page and use <span className="text-white">Message</span> to
            start a conversation about a commission.
          </p>
          <Link href="/artists" className="mt-4 inline-block rounded-lg btn-hard px-5 py-2.5 tag font-bold">
            Browse artists
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-edge">
          {threads.map((t) => (
            <Link
              key={t.userId}
              href={`/messages/${t.userId}`}
              className={`flex items-start justify-between gap-3 border-b border-edge/60 px-4 py-3 transition last:border-0 hover:bg-panel ${
                t.unread > 0 ? "bg-volt/5" : "bg-surface"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-white">
                  {t.name}
                  {t.artistSlug && <span className="ml-1.5 tag text-heat">artist</span>}
                </p>
                <p className="truncate text-sm text-smoke">
                  {t.fromMe && <span className="text-smoke/70">You: </span>}
                  {t.lastBody}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tag text-smoke">
                  {t.lastAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                {t.unread > 0 && (
                  <span className="mt-1 inline-block rounded-full bg-volt px-2 py-0.5 text-[10px] font-bold text-ink">
                    {t.unread}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

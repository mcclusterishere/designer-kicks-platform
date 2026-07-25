"use client";

import { useActionState, useState } from "react";
import {
  saveSocialTarget,
  fillDripQueue,
  cancelDripPost,
  drainDripNow,
  type ActionResult,
  type FillResult,
} from "@/app/actions";

const field =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

export type TargetRow = {
  id: string;
  platform: string;
  name: string | null;
  label: string;
  active: boolean;
  allowLinks: boolean;
  allowSelfPromo: boolean;
  allowAffiliate: boolean;
  requireFlair: boolean;
  minHoursBetween: number;
  maxPerWeek: number;
  rulesNote: string | null;
  queued: number;
  blocked: number;
  posted: number;
};

export type QueueRow = {
  id: string;
  targetLabel: string;
  title: string;
  status: string;
  scheduledFor: string;
  blockedReason: string | null;
  result: string | null;
};

/**
 * The distribution desk.
 *
 * Everything here is built around one fact: the communities worth posting
 * in have rules, and the rules ban exactly what an automated feed does by
 * default. So a destination stores its rules, the queue is checked against
 * them, and nothing goes out that a moderator would remove.
 */
export default function DripFeed({ targets, queue }: { targets: TargetRow[]; queue: QueueRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [fill, setFill] = useState<Record<string, FillResult | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [drain, setDrain] = useState<string | null>(null);

  async function build(targetId: string, kind: string, count: number) {
    setBusy(targetId);
    const res = await fillDripQueue(targetId, kind, count);
    setFill((f) => ({ ...f, [targetId]: res }));
    setBusy(null);
  }

  return (
    <section className="mt-10 rounded-xl border border-heat/40 bg-panel p-5">
      <h2 className="display text-2xl text-white">Drip Feed</h2>
      <p className="mt-1 max-w-3xl text-sm text-smoke">
        Release the work you&apos;ve already made, one post at a time, at each
        place&apos;s own pace. Copy is written per platform — Reddit gets the maker
        and the piece, X gets the hook — because the same post everywhere reads as
        a bot in at least one of them.
      </p>
      <p className="mt-2 max-w-3xl rounded-lg border border-edge bg-surface px-3 py-2 text-xs leading-relaxed text-smoke">
        <span className="font-bold text-heat">Why the rule switches matter.</span>{" "}
        r/Customsneakers bans self-promo in titles, affiliate links and bulk posting.
        Turn those off for that destination and the queue refuses anything that would
        break them — a title with the brand in it, a link where links aren&apos;t
        welcome — before it ever reaches a moderator. A banned account posts nothing,
        so this is the setting that gets the most content out, not the least.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form
          action={async () => {
            const out = await drainDripNow();
            setDrain(`Sent ${out.sent}, failed ${out.failed}, held ${out.skipped}.`);
          }}
        >
          <button className="rounded-lg btn-hard px-4 py-2 tag font-bold">Send what&apos;s due now</button>
        </form>
        {drain && <span className="tag text-volt">{drain}</span>}
      </div>

      {/* Destinations */}
      <div className="mt-5 space-y-2">
        {targets.length === 0 && (
          <p className="rounded-lg border border-dashed border-edge bg-surface p-4 text-sm text-smoke">
            No destinations yet. Add one below — start with a single subreddit and a
            slow cadence.
          </p>
        )}
        {targets.map((t) => (
          <div key={t.id} className="rounded-lg border border-edge bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-white">
                  {t.label}
                  {!t.active && <span className="ml-2 tag text-smoke">paused</span>}
                </p>
                <p className="tag text-smoke">
                  {t.platform} · 1 post / {t.minHoursBetween}h · max {t.maxPerWeek}/week
                  {!t.allowSelfPromo && " · no self-promo"}
                  {!t.allowLinks && " · no links"}
                  {!t.allowAffiliate && " · no affiliate"}
                </p>
                <p className="tag mt-0.5 text-smoke">
                  <span className="text-volt">{t.queued} queued</span>
                  {t.blocked > 0 && <span className="text-heat"> · {t.blocked} blocked</span>}
                  {" · "}{t.posted} posted
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <button
                  onClick={() => build(t.id, "PIECE", 5)}
                  disabled={busy === t.id}
                  className="rounded border border-volt px-3 py-1.5 tag font-bold text-volt disabled:opacity-50"
                >
                  {busy === t.id ? "…" : "+5 customs"}
                </button>
                <button
                  onClick={() => build(t.id, "ARTICLE", 5)}
                  disabled={busy === t.id}
                  className="rounded border border-edge px-3 py-1.5 tag text-white disabled:opacity-50"
                >
                  +5 articles
                </button>
                <button
                  onClick={() => setOpenId(openId === t.id ? null : t.id)}
                  className="rounded border border-edge px-3 py-1.5 tag text-smoke"
                >
                  {openId === t.id ? "Close" : "Rules"}
                </button>
              </div>
            </div>

            <FillReport report={fill[t.id] ?? null} />

            {openId === t.id && <TargetForm target={t} />}
          </div>
        ))}
      </div>

      {/* Add a destination */}
      <details className="mt-4 rounded-lg border border-edge bg-surface p-3">
        <summary className="cursor-pointer tag text-white">Add a destination</summary>
        <div className="mt-3">
          <TargetForm target={null} />
        </div>
      </details>

      {/* The queue itself */}
      <div className="mt-6">
        <p className="display text-lg text-white">Up next</p>
        <p className="mt-0.5 text-xs text-smoke">
          Exactly what will go out, and when. Read it before it posts — edit by
          cancelling and re-queuing.
        </p>
        <div className="mt-2 overflow-hidden rounded-lg border border-edge">
          {queue.length === 0 ? (
            <p className="bg-surface p-4 text-sm text-smoke">Nothing queued.</p>
          ) : (
            queue.map((q) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-3 border-b border-edge/60 bg-surface px-3 py-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{q.title}</p>
                  <p className="tag text-smoke">
                    {q.targetLabel} ·{" "}
                    <span
                      className={
                        q.status === "BLOCKED" || q.status === "FAILED" ? "text-heat" : "text-volt"
                      }
                    >
                      {q.status.toLowerCase()}
                    </span>{" "}
                    · {new Date(q.scheduledFor).toLocaleString()}
                  </p>
                  {q.blockedReason && <p className="tag text-heat">{q.blockedReason}</p>}
                  {q.result && <p className="tag text-smoke">{q.result}</p>}
                </div>
                <form action={cancelDripPost.bind(null, q.id)} className="shrink-0">
                  <button className="rounded border border-edge px-2.5 py-1 tag text-smoke hover:text-white">
                    Cancel
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * What a queue-building run actually did, including what it refused.
 *
 * Blocked items are listed with the rule they broke rather than hidden —
 * seeing "self-promo in title" three times in a row is how you learn to
 * write the next batch properly.
 */
function FillReport({ report }: { report: FillResult | null }) {
  if (!report) return null;
  if (!report.ok) {
    return (
      <div className="mt-2 rounded border border-edge bg-panel p-2.5 text-xs">
        <p className="text-heat">{report.error}</p>
      </div>
    );
  }
  return (
    <div className="mt-2 rounded border border-edge bg-panel p-2.5 text-xs">
      <p className="tag text-volt">
        queued {report.queued}
        {report.blocked > 0 && <span className="text-heat"> · blocked {report.blocked}</span>}
      </p>
      <ul className="mt-1 space-y-0.5">
        {report.details.map((d, i) => (
          <li key={i} className={d.status === "BLOCKED" ? "text-heat" : "text-smoke"}>
            {d.status === "BLOCKED" ? "✕" : "→"} {d.source}
            {d.status === "BLOCKED"
              ? ` — ${d.note}`
              : d.when
                ? ` — ${new Date(d.when).toLocaleString()}`
                : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TargetForm({ target }: { target: TargetRow | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveSocialTarget, null);
  const t = target;

  return (
    <form action={action} className="mt-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="tag text-smoke">Platform</label>
          <select name="platform" defaultValue={t?.platform ?? "REDDIT"} className={field}>
            {["REDDIT", "X", "BLUESKY", "TELEGRAM", "DISCORD"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="tag text-smoke">Subreddit / handle</label>
          <input name="name" defaultValue={t?.name ?? ""} placeholder="Customsneakers" className={field} />
        </div>
        <div>
          <label className="tag text-smoke">Label</label>
          <input name="label" defaultValue={t?.label ?? ""} placeholder="r/Customsneakers" className={field} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="tag text-smoke">Hours between posts</label>
          <input name="minHoursBetween" type="number" min={1} max={720} defaultValue={t?.minHoursBetween ?? 48} className={field} />
        </div>
        <div>
          <label className="tag text-smoke">Max per week</label>
          <input name="maxPerWeek" type="number" min={1} max={50} defaultValue={t?.maxPerWeek ?? 2} className={field} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {(
          [
            ["active", "Active", t ? t.active : true],
            ["allowLinks", "Links allowed", t ? t.allowLinks : false],
            ["allowSelfPromo", "Self-promo allowed", t ? t.allowSelfPromo : false],
            ["allowAffiliate", "Affiliate links allowed", t ? t.allowAffiliate : false],
            ["requireFlair", "Flair required", t ? t.requireFlair : false],
          ] as const
        ).map(([nameAttr, label, checked]) => (
          <label key={nameAttr} className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" name={nameAttr} defaultChecked={checked} className="h-4 w-4 accent-current" />
            {label}
          </label>
        ))}
      </div>

      <div className="mt-3">
        <label className="tag text-smoke">Their rules, in their words</label>
        <textarea
          name="rulesNote"
          rows={2}
          defaultValue={t?.rulesNote ?? ""}
          placeholder="No self-promo in titles or photos. No affiliate links. No bulk posting. Custom shoes only."
          className={field}
        />
      </div>

      {state && !state.ok && <p className="mt-2 text-sm text-heat">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-volt">{state.note}</p>}

      <button disabled={pending} className="mt-3 rounded-lg btn-hard px-4 py-2 tag font-bold disabled:opacity-50">
        {pending ? "Saving…" : t ? "Save rules" : "Add destination"}
      </button>
    </form>
  );
}

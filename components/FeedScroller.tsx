"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  addFeedComment,
  answerFeedQuestion,
  getCallOutOptions,
  rateDesign,
  throwCallOut,
  toggleFeedReaction,
  type CallOutOption,
} from "@/app/actions";
import type { FeedItem } from "@/lib/feed";
import { categoryLabel } from "@/lib/categories";

// The infinite scroll machine. Pages through /api/feed with an
// IntersectionObserver sentinel — no button, no page numbers, it just
// keeps going until the algorithm runs dry.

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function Flames({ score }: { score: number }) {
  const lit = Math.round(score);
  return (
    <span>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= lit ? undefined : "opacity-25"}>
          🔥
        </span>
      ))}
    </span>
  );
}

function PostCard({
  item,
  signedIn,
}: {
  item: Extract<FeedItem, { type: "post" }>;
  signedIn: boolean;
}) {
  const [reactions, setReactions] = useState(item.reactions);
  const [mine, setMine] = useState(item.mine);
  const [comments, setComments] = useState(item.comments);
  const [commentCount, setCommentCount] = useState(item.commentCount);
  const [draft, setDraft] = useState("");
  const [talkOpen, setTalkOpen] = useState(false);
  const [shared, setShared] = useState(false);

  async function react() {
    // Optimistic flame; the server answer settles it.
    setMine((m) => !m);
    setReactions((n) => (mine ? n - 1 : n + 1));
    const res = await toggleFeedReaction(item.id);
    if (res.ok) {
      setReactions(res.count);
      setMine(res.mine);
    }
  }

  async function submitComment() {
    const body = draft.trim();
    if (!body) return;
    const res = await addFeedComment(item.id, body);
    if (res.ok) {
      setComments((prev) => [...prev.slice(-4), res.comment]);
      setCommentCount((n) => n + 1);
      setDraft("");
    }
  }

  async function share() {
    const url = `${location.origin}/`;
    const text = item.body.slice(0, 200);
    try {
      if (navigator.share) {
        await navigator.share({ title: "The Heat Chart", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n\n${url}`);
      }
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {}
  }

  return (
    <article
      className="overflow-hidden rounded-2xl border border-edge bg-surface"
      data-testid="feed-item"
      data-feed-type="post"
    >
      <div className="flex items-center gap-2 px-4 pt-4">
        {item.artistSlug ? (
          <Link href={`/artists/${item.artistSlug}`} className="tag rounded border border-volt/60 px-2 py-0.5 font-bold text-volt">
            {item.artistName}
          </Link>
        ) : (
          <span className="tag rounded bg-volt px-2 py-0.5 font-bold text-ink">The Heat Chart</span>
        )}
        <span className="tag text-smoke">{timeAgo(item.createdAt)}</span>
      </div>
      <p className="whitespace-pre-line px-4 py-3 text-white">{item.body}</p>
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="max-h-[480px] w-full object-cover" />
      )}
      {item.linkUrl && (
        <div className="px-4 pt-3">
          <a
            href={item.linkUrl}
            className="tag text-volt underline underline-offset-4"
            {...(item.linkUrl.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          >
            {item.linkLabel || "Check it out"} →
          </a>
        </div>
      )}

      {/* Fan lane: react, talk, share */}
      <div className="mt-2 flex items-center gap-1 border-t border-edge/60 px-2 py-1.5">
        {signedIn ? (
          <button
            type="button"
            onClick={react}
            data-testid="feed-react"
            className={`tag rounded-lg px-3 py-2 transition ${mine ? "text-volt" : "text-smoke hover:text-white"}`}
          >
            <span className={mine ? undefined : "opacity-50"}>🔥</span> {reactions}
          </button>
        ) : (
          <Link href="/signin" className="tag rounded-lg px-3 py-2 text-smoke hover:text-white">
            <span className="opacity-50">🔥</span> {reactions}
          </Link>
        )}
        <button
          type="button"
          onClick={() => setTalkOpen((o) => !o)}
          data-testid="feed-talk"
          className="tag rounded-lg px-3 py-2 text-smoke transition hover:text-white"
        >
          Talk · {commentCount}
        </button>
        <button
          type="button"
          onClick={share}
          className="tag ml-auto rounded-lg px-3 py-2 text-smoke transition hover:text-white"
        >
          {shared ? "Copied ✓" : "Share"}
        </button>
      </div>

      {(talkOpen || comments.length > 0) && (
        <div className="border-t border-edge/60 px-4 py-3">
          {comments.map((c) => (
            <p key={c.id} className="py-1 text-sm">
              <span className="font-bold text-white">{c.name}</span>{" "}
              <span className="text-smoke">{c.body}</span>
            </p>
          ))}
          {talkOpen &&
            (signedIn ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitComment()}
                  maxLength={500}
                  placeholder="Say something…"
                  className="min-w-0 flex-1 rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
                />
                <button type="button" onClick={submitComment} className="tag shrink-0 text-volt underline">
                  post
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-smoke">
                <Link href="/signin" className="text-volt underline">Sign in</Link> to join the talk.
              </p>
            ))}
        </div>
      )}
    </article>
  );
}

/**
 * A piece in the feed IS the Rate game: unrated pieces show the five
 * flames right on the card, and approved artists can Call Out the
 * piece with one of their own — matched by Heat Score — spinning up a
 * live battle on the spot.
 */
function PieceCard({
  item,
  signedIn,
  viewerArtistSlug,
}: {
  item: Extract<FeedItem, { type: "piece" }>;
  signedIn: boolean;
  viewerArtistSlug: string | null;
}) {
  const [myStars, setMyStars] = useState(item.myStars);
  const [verdict, setVerdict] = useState<{ avg: number; count: number } | null>(null);
  const [rating, setRating] = useState(false);
  const [heat, setHeat] = useState(item.heat);
  const [callout, setCallout] = useState<
    | { state: "closed" }
    | { state: "picking"; options: CallOutOption[] }
    | { state: "sent"; battleId: string }
    | { state: "error"; message: string }
  >({ state: "closed" });

  async function rate(stars: number) {
    if (rating || myStars !== null) return;
    setRating(true);
    const res = await rateDesign(item.id, stars);
    if (res.ok) {
      setMyStars(stars);
      setVerdict({ avg: res.avg ?? stars, count: res.count ?? 1 });
      setHeat({ score: res.avg ?? stars, count: res.count ?? 1 });
    }
    setRating(false);
  }

  async function openCallOut() {
    const res = await getCallOutOptions(item.id);
    if (res.ok) setCallout({ state: "picking", options: res.options });
    else setCallout({ state: "error", message: res.error });
  }

  async function pickCallOut(mySubmissionId: string) {
    const res = await throwCallOut(item.id, mySubmissionId);
    if (res.ok) setCallout({ state: "sent", battleId: res.battleId });
    else setCallout({ state: "error", message: res.error });
  }

  const canCallOut =
    signedIn && viewerArtistSlug !== null && viewerArtistSlug !== item.artistSlug;

  return (
    <article
      className="overflow-hidden rounded-2xl border border-edge bg-surface transition hover:border-volt/50"
      data-testid="feed-item"
      data-feed-type="piece"
    >
      <Link href={item.artistSlug ? `/artists/${item.artistSlug}` : "/artists"} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={item.title} className="aspect-square w-full object-cover" />
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-white">{item.title}</p>
            <p className="mt-0.5 text-sm text-smoke">
              by{" "}
              {item.artistSlug ? (
                <Link href={`/artists/${item.artistSlug}`} className="text-volt underline underline-offset-4">
                  {item.artistName}
                </Link>
              ) : (
                item.artistName
              )}
              {item.brand && <span> · {item.brand}</span>}
              {item.category !== "sneakers" && (
                <span className="text-volt"> · {categoryLabel(item.category)}</span>
              )}
            </p>
          </div>
          {canCallOut && callout.state === "closed" && (
            <button
              type="button"
              onClick={openCallOut}
              data-testid="feed-callout"
              className="tag shrink-0 rounded-full border border-heat/60 px-3 py-1.5 text-heat transition hover:border-heat hover:text-white"
            >
              Call Out
            </button>
          )}
        </div>

        {/* The Heat Score booth — vote right here */}
        {signedIn && myStars === null ? (
          <div className="mt-3">
            <p className="tag text-smoke">Rate the heat</p>
            <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Rate this design out of 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => rate(n)}
                  disabled={rating}
                  data-testid="feed-rate"
                  aria-label={`${n} flame${n === 1 ? "" : "s"}`}
                  className="flex-1 rounded-lg border border-edge bg-panel py-2 text-lg transition hover:border-volt disabled:opacity-60"
                >
                  <span className="opacity-40">🔥</span>
                  <span className="mt-0.5 block text-[10px] text-smoke">{n}</span>
                </button>
              ))}
            </div>
          </div>
        ) : verdict ? (
          <p className="mt-2 text-sm text-volt" data-testid="feed-rate-verdict">
            You said {myStars} · the culture says{" "}
            <span className="display text-base">{verdict.avg}</span> ({verdict.count})
          </p>
        ) : (
          item.heat && (
            <p className="mt-1 text-sm">
              <Flames score={item.heat.score} />
              <span className="tag ml-1.5 text-volt">{heat?.score.toFixed(1) ?? item.heat.score.toFixed(1)}</span>
              <span className="tag text-smoke"> · {item.heat.count} rating{item.heat.count === 1 ? "" : "s"}</span>
            </p>
          )
        )}

        {/* Call Out flow */}
        {callout.state === "picking" && (
          <div className="mt-3 rounded-xl border border-heat/40 bg-panel p-3">
            <p className="tag text-heat">Pick your fighter — closest heat first</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {callout.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pickCallOut(o.id)}
                  className="tag rounded-full border border-edge px-3 py-1.5 text-white transition hover:border-heat"
                >
                  {o.title}
                  {o.heat !== null && <span className="text-smoke"> · {o.heat.toFixed(1)}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        {callout.state === "sent" && (
          <p className="mt-3 text-sm text-heat" data-testid="feed-callout-sent">
            Challenge is live ·{" "}
            <Link href={`/battles/${callout.battleId}`} className="text-volt underline underline-offset-4">
              watch the battle →
            </Link>
          </p>
        )}
        {callout.state === "error" && (
          <p className="mt-3 text-sm text-smoke">{callout.message}</p>
        )}
      </div>
    </article>
  );
}

/**
 * A culture question floating in the feed. One shot per question,
 * forever — correct answers build the Culture IQ that follows you.
 */
function QuestionCard({
  item,
  signedIn,
}: {
  item: Extract<FeedItem, { type: "question" }>;
  signedIn: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{
    correct: boolean;
    answerIndex: number;
    explanation: string | null;
    iq: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function answer(i: number) {
    if (busy || result) return;
    setBusy(true);
    setPicked(i);
    const res = await answerFeedQuestion(item.id, i);
    if (res.ok) {
      setResult({
        correct: res.correct,
        answerIndex: res.answerIndex,
        explanation: res.explanation,
        iq: res.iq,
      });
    } else {
      setPicked(null);
    }
    setBusy(false);
  }

  return (
    <article
      className="overflow-hidden rounded-2xl border border-volt/30 bg-surface"
      data-testid="feed-item"
      data-feed-type="question"
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="tag text-volt">Culture check</span>
        {result && (
          <span className="tag text-smoke" data-testid="feed-iq">
            Culture IQ → <span className="text-volt">{result.iq}</span>
          </span>
        )}
      </div>
      <p className="px-4 py-3 font-bold text-white">{item.question}</p>
      <div className="grid grid-cols-1 gap-1.5 px-4 pb-4">
        {item.options.map((opt, i) =>
          signedIn ? (
            <button
              key={i}
              type="button"
              onClick={() => answer(i)}
              disabled={busy || result !== null}
              data-testid="feed-question-option"
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                result
                  ? i === result.answerIndex
                    ? "border-volt bg-volt/10 text-volt"
                    : i === picked
                      ? "border-heat bg-heat/10 text-heat"
                      : "border-edge text-smoke opacity-60"
                  : "border-edge bg-panel text-white hover:border-volt"
              }`}
            >
              {opt}
            </button>
          ) : (
            <Link
              key={i}
              href="/signin"
              className="rounded-lg border border-edge bg-panel px-3 py-2.5 text-sm text-white transition hover:border-volt"
            >
              {opt}
            </Link>
          )
        )}
        {result && (
          <div className="mt-1 text-sm">
            <p className={result.correct ? "text-volt" : "text-heat"}>
              {result.correct ? "Correct — +2 IQ." : "Missed it — that's −3 IQ. One shot each, forever."}
            </p>
            {result.explanation && <p className="mt-1 text-smoke">{result.explanation}</p>}
            <p className="mt-1.5 flex flex-wrap gap-3">
              {item.articleSlug && (
                <Link href={`/news/${item.articleSlug}`} className="tag text-volt underline underline-offset-4">
                  Study the story →
                </Link>
              )}
              {!result.correct && (
                <Link href="/profile#iq" className="tag text-smoke underline underline-offset-4">
                  Clear this miss with a credit →
                </Link>
              )}
            </p>
          </div>
        )}
        {!signedIn && (
          <p className="tag mt-1 text-smoke">
            <Link href="/signin" className="text-volt underline">Sign in</Link> to play — every answer builds your Culture IQ.
          </p>
        )}
      </div>
    </article>
  );
}

function Card({
  item,
  signedIn,
  viewerArtistSlug,
}: {
  item: FeedItem;
  signedIn: boolean;
  viewerArtistSlug: string | null;
}) {
  const shell = "overflow-hidden rounded-2xl border border-edge bg-surface";
  if (item.type === "post") {
    return <PostCard item={item} signedIn={signedIn} />;
  }
  if (item.type === "battle") {
    return (
      <Link href={`/battles/${item.id}`} className="block" data-testid="feed-item" data-feed-type="battle">
        <article className={`${shell} transition hover:border-heat/60`}>
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="tag text-heat">Live battle</span>
            <span className="tag text-smoke">{item.votes} votes</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-edge p-4 pt-3">
            {[item.a, item.b].map((side, i) => (
              <div key={i} className="bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={side.imageUrl} alt={side.title} className="aspect-square w-full object-cover" />
                <p className="mt-1.5 truncate text-sm font-bold text-white">{side.title}</p>
                <p className="truncate text-xs text-smoke">{side.artistName}</p>
              </div>
            ))}
          </div>
          <p className="border-t border-edge px-4 py-2.5 text-center tag text-heat">
            Vote now →
          </p>
        </article>
      </Link>
    );
  }
  if (item.type === "piece") {
    return <PieceCard item={item} signedIn={signedIn} viewerArtistSlug={viewerArtistSlug} />;
  }
  if (item.type === "question") {
    return <QuestionCard item={item} signedIn={signedIn} />;
  }
  return (
    <Link href={`/news/${item.slug}`} className="block" data-testid="feed-item" data-feed-type="drop">
      <article className={`${shell} transition hover:border-volt/50`}>
        {item.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover} alt={item.name} className="max-h-72 w-full object-cover" />
        )}
        <div className="p-4">
          <span className="tag text-volt">
            {item.dropAt && new Date(item.dropAt).getTime() > Date.now() ? "Dropping soon" : "The story"}
          </span>
          <p className="mt-1 font-bold text-white">{item.name}</p>
          <p className="mt-1 line-clamp-2 text-sm text-smoke">{item.excerpt}</p>
        </div>
      </article>
    </Link>
  );
}

export default function FeedScroller() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [viewerArtistSlug, setViewerArtistSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<number | null>(0);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    const offset = offsetRef.current;
    if (offset === null || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?offset=${offset}&limit=8`);
      const page = (await res.json()) as {
        items: FeedItem[];
        nextOffset: number | null;
        signedIn: boolean;
        viewerArtistSlug: string | null;
      };
      setItems((prev) => [...prev, ...page.items]);
      setSignedIn(page.signedIn);
      setViewerArtistSlug(page.viewerArtistSlug ?? null);
      offsetRef.current = page.nextOffset;
      if (page.nextOffset === null) setDone(true);
    } catch {
      /* transient — the sentinel retries on the next scroll */
    }
    loadingRef.current = false;
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <div className="mx-auto max-w-xl">
      <div className="space-y-4" data-testid="feed-list">
        {items.map((item, i) => (
          <Card
            key={`${item.type}-${"id" in item ? item.id : item.slug}-${i}`}
            item={item}
            signedIn={signedIn}
            viewerArtistSlug={viewerArtistSlug}
          />
        ))}
      </div>
      <div ref={sentinel} />
      {loading && <p className="py-6 text-center tag text-smoke">Loading heat…</p>}
      {done && items.length > 0 && (
        <p className="py-8 text-center tag text-smoke">You&apos;re all caught up.</p>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addFeedComment, toggleFeedReaction } from "@/app/actions";
import type { FeedItem } from "@/lib/feed";

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

function Card({ item, signedIn }: { item: FeedItem; signedIn: boolean }) {
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
    const inner = (
      <article className={`${shell} transition hover:border-volt/50`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={item.title} className="aspect-square w-full object-cover" />
        <div className="p-4">
          <p className="font-bold text-white">{item.title}</p>
          <p className="mt-0.5 text-sm text-smoke">
            by {item.artistName}
            {item.brand && <span> · {item.brand}</span>}
          </p>
          {item.heat && (
            <p className="mt-1 text-sm">
              <Flames score={item.heat.score} />
              <span className="tag ml-1.5 text-volt">{item.heat.score.toFixed(1)}</span>
            </p>
          )}
        </div>
      </article>
    );
    return item.artistSlug ? (
      <Link href={`/artists/${item.artistSlug}`} className="block" data-testid="feed-item" data-feed-type="piece">
        {inner}
      </Link>
    ) : (
      <div data-testid="feed-item" data-feed-type="piece">{inner}</div>
    );
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
      };
      setItems((prev) => [...prev, ...page.items]);
      setSignedIn(page.signedIn);
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

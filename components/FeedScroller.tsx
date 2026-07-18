"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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

function Card({ item }: { item: FeedItem }) {
  const shell = "overflow-hidden rounded-2xl border border-edge bg-surface";
  if (item.type === "post") {
    return (
      <article className={shell} data-testid="feed-item" data-feed-type="post">
        <div className="flex items-center gap-2 px-4 pt-4">
          <span className="tag rounded bg-volt px-2 py-0.5 font-bold text-ink">The Heat Chart</span>
          <span className="tag text-smoke">{timeAgo(item.createdAt)}</span>
        </div>
        <p className="whitespace-pre-line px-4 py-3 text-white">{item.body}</p>
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="max-h-[480px] w-full object-cover" />
        )}
        {item.linkUrl && (
          <div className="px-4 py-3">
            <a
              href={item.linkUrl}
              className="tag text-volt underline underline-offset-4"
              {...(item.linkUrl.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            >
              {item.linkLabel || "Check it out"} →
            </a>
          </div>
        )}
      </article>
    );
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
      const page = (await res.json()) as { items: FeedItem[]; nextOffset: number | null };
      setItems((prev) => [...prev, ...page.items]);
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
          <Card key={`${item.type}-${"id" in item ? item.id : item.slug}-${i}`} item={item} />
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

"use client";

import { useRef, useState } from "react";

/**
 * Inline swipe gallery: thumb-scroll through a piece's angles right on
 * the card — scroll-snap, dot indicators, arrows on hover. No modal,
 * no new tab. Shared by the battle vote panel and the Rate deck.
 */
export default function SwipeGallery({
  images,
  alt,
  testId,
  fit = "cover",
}: {
  images: string[];
  alt: string;
  testId?: string;
  /** "cover" crops to fill (photography); "contain" shows the whole product
   *  on a light plate (catalog PNGs — never square-crop a product shot). */
  fit?: "cover" | "contain";
}) {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const go = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div
      className={`group/gallery relative aspect-square w-full ${
        fit === "contain" ? "bg-[#f2f1ee]" : "bg-panel"
      }`}
    >
      <div
        ref={trackRef}
        data-testid={testId}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIdx(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
      >
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={i === 0 ? alt : `${alt} — angle ${i + 1}`}
            className={`h-full w-full shrink-0 snap-center ${
              fit === "contain" ? "object-contain p-6" : "object-cover"
            }`}
          />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition focus-visible:opacity-100 group-hover/gallery:opacity-100 group-focus-within/gallery:opacity-100"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition focus-visible:opacity-100 group-hover/gallery:opacity-100 group-focus-within/gallery:opacity-100"
          >
            ›
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-5 bg-volt" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
          <span className="tag pointer-events-none absolute right-2 top-2 rounded bg-ink/70 px-2 py-1 text-white">
            {idx + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  );
}

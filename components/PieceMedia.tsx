"use client";

import { useEffect, useRef } from "react";

/**
 * A submission's media, video-first. When a maker uploaded a clip, we
 * play it as a silent, looping, in-view autoplay video (the modern "GIF"
 * — smaller and sharper than an actual GIF, hardware-decoded, no audio)
 * with the still photo as the poster for instant paint. No clip → the
 * photo. Only the on-screen card plays, so a feed full of videos stays
 * light on battery and data.
 */
export default function PieceMedia({
  imageUrl,
  videoUrl,
  title,
  className = "",
  badge = true,
}: {
  imageUrl: string;
  videoUrl?: string | null;
  title: string;
  className?: string;
  badge?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true; // set as a property so autoplay is allowed
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.4 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  if (videoUrl) {
    return (
      <div className="relative">
        <video
          ref={ref}
          src={videoUrl}
          poster={imageUrl || undefined}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={title}
          className={className}
        />
        {badge && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
            ▶ VIDEO
          </span>
        )}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt={title} className={className} />
  );
}

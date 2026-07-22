"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll-reveal wrapper: children arrive when they enter the viewport —
 * fade-up by default, with per-element delay for staggering. Fires
 * once; respects prefers-reduced-motion via the CSS (the transition
 * is stripped there, so content just appears).
 */
export default function Reveal({
  children,
  delay = 0,
  from = "up",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  from?: "up" | "left" | "right" | "scale";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hidden =
    from === "left"
      ? "translate-x-[-24px] opacity-0"
      : from === "right"
        ? "translate-x-[24px] opacity-0"
        : from === "scale"
          ? "scale-[0.94] opacity-0"
          : "translate-y-6 opacity-0";

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal-item transition-all duration-700 ease-out ${
        on ? "translate-x-0 translate-y-0 scale-100 opacity-100" : hidden
      } ${className}`}
    >
      {children}
    </div>
  );
}

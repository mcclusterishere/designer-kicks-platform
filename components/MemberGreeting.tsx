"use client";

import { useEffect, useState } from "react";

/**
 * "We know you" at the top of the home page: greets the signed-in
 * member by first name AND by their own clock — morning / afternoon /
 * evening / late-night, read from the device so it's always their
 * local time. Renders a stable server-safe fallback first, then the
 * time-aware line after mount (no hydration mismatch).
 */
function timeWord(hour: number): { word: string; emoji: string } {
  if (hour < 5) return { word: "Up late", emoji: "🌙" };
  if (hour < 12) return { word: "Morning", emoji: "☀️" };
  if (hour < 17) return { word: "Afternoon", emoji: "🔥" };
  if (hour < 21) return { word: "Evening", emoji: "🌆" };
  return { word: "Late night", emoji: "🌙" };
}

export default function MemberGreeting({ firstName }: { firstName: string }) {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    const { word, emoji } = timeWord(new Date().getHours());
    setLine(`${word}, ${firstName} ${emoji}`);
  }, [firstName]);

  return (
    <span className="text-sm font-medium tracking-wide text-white">
      {line ?? `Welcome back, ${firstName}`}
    </span>
  );
}

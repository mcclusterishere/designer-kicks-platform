import { heatScore } from "@/lib/analytics";

/**
 * The public Heat Score: five flames plus the smoothed Rate-game
 * number. Renders nothing until the piece has been rated at least
 * once. Server component — safe anywhere.
 */
export default function HeatScore({ stars }: { stars: number[] }) {
  const hs = heatScore(stars);
  if (!hs) return null;
  const lit = Math.round(hs.score);
  return (
    <p
      className="mt-1 text-sm"
      data-testid="heat-score"
      title={`Heat Score ${hs.score} out of 5 — from ${hs.count} Rate-game rating${hs.count === 1 ? "" : "s"}`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= lit ? undefined : "opacity-25"}>
          🔥
        </span>
      ))}
      <span className="tag ml-1.5 text-volt">{hs.score.toFixed(1)}</span>
      <span className="tag text-smoke"> · {hs.count} rating{hs.count === 1 ? "" : "s"}</span>
    </p>
  );
}

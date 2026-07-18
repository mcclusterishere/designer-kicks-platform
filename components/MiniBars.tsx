/** Tiny server-rendered bar chart — no chart library, no client JS. */
export default function MiniBars({
  series,
  accent = "volt",
}: {
  series: { day: string; count: number }[];
  accent?: "volt" | "heat";
}) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const w = 12;
  const gap = 4;
  const h = 48;
  const width = series.length * (w + gap) - gap;
  const fill = accent === "volt" ? "#d9b96a" : "#c65a2e";
  return (
    <svg
      viewBox={`0 0 ${width} ${h}`}
      className="h-12 w-full"
      role="img"
      aria-label={`Last ${series.length} days, peak ${max} per day`}
      preserveAspectRatio="none"
    >
      {series.map((s, i) => {
        const barH = Math.max(2, Math.round((s.count / max) * (h - 4)));
        return (
          <rect
            key={s.day}
            x={i * (w + gap)}
            y={h - barH}
            width={w}
            height={barH}
            rx={2}
            fill={fill}
            opacity={s.count === 0 ? 0.18 : 0.9}
          >
            <title>{`${s.day}: ${s.count}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

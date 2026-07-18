const ITEMS = [
  "Live battles — vote now",
  "Championship brackets",
  "Pass the Heat Check, win rare heat",
  "The Drop Report",
  "Submit your customs",
  "Climb the league",
];

export default function HypeTicker() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="overflow-hidden border-y border-edge bg-surface py-2.5" aria-hidden>
      <div className="ticker-track">
        {row.map((item, i) => (
          <span key={i} className="tag flex items-center whitespace-nowrap px-7 text-smoke">
            <span className="mr-7 text-volt">◆</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

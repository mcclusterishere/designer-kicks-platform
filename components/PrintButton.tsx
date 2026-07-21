"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="tag rounded-full border border-edge px-4 py-2 text-smoke transition hover:border-volt hover:text-white print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}

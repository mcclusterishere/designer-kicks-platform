"use client";

// Global error boundary. Shown when a server render or query throws —
// most likely under load if the DB is briefly overwhelmed. Branded and
// reassuring, with a retry, instead of a raw stack trace.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="tag text-heat">Something ran hot</p>
      <h1 className="display mt-2 text-4xl text-white">Give it a second</h1>
      <p className="mt-3 text-smoke">
        We hit a snag loading this — usually a momentary hiccup when a lot
        of people are on at once. Try again.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg btn-hard px-6 py-3 tag font-bold"
        >
          Try Again
        </button>
        <a
          href="/"
          className="rounded-lg border border-edge px-6 py-3 tag text-white hover:border-volt"
        >
          Back Home
        </a>
      </div>
    </div>
  );
}

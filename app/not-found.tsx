import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="tag text-heat">404</p>
      <h1 className="display mt-2 text-4xl text-white">Nothing on this shelf</h1>
      <p className="mt-3 text-smoke">
        This page moved on or never dropped. The heat&apos;s still going —
        head back and find it.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-lg btn-hard px-6 py-3 tag font-bold">
          Back Home
        </Link>
        <Link href="/drops" className="rounded-lg border border-edge px-6 py-3 tag text-white hover:border-volt">
          The Drop Calendar
        </Link>
      </div>
    </div>
  );
}

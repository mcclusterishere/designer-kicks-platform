"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Four doors. Everything else lives inside them. The selected door
// stays lit — same rule the phone tab bar follows.
const LINKS = [
  {
    href: "/battles",
    label: "Arena",
    match: ["/battles", "/outfits", "/rate", "/games", "/tournaments", "/artists", "/heat-list", "/quiz", "/giveaway"],
  },
  { href: "/drops", label: "Drops", match: ["/drops", "/news"] },
  // Catalog is a view inside the Market now, not a door of its own —
  // one set of shoes shouldn't need two words in the nav.
  { href: "/market", label: "Market", match: ["/market", "/catalog", "/predict", "/collectors", "/shop"] },
];

function lit(pathname: string, match: string[]): boolean {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

export default function HeaderNav({
  account,
  unread = 0,
}: {
  account: { href: string; label: string };
  /** Unread direct messages, shown as a dot on the account door. */
  unread?: number;
}) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] p-1 md:flex">
      {LINKS.map((l) => {
        const active = lit(pathname, l.match);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`tag rounded-full px-3.5 py-2 transition lg:px-5 ${
              active
                ? "bg-volt/15 font-bold text-volt"
                : "text-smoke hover:bg-white/5 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
      <Link
        href="/submit"
        aria-current={pathname.startsWith("/submit") ? "page" : undefined}
        className="btn-hard tag rounded-full px-3.5 py-2 font-bold lg:px-5"
      >
        Submit
      </Link>
      <Link
        href={account.href}
        aria-current={pathname.startsWith("/profile") ? "page" : undefined}
        className={`relative tag rounded-full border px-3.5 py-2 transition lg:px-5 ${
          pathname.startsWith("/profile")
            ? "border-volt bg-volt/10 text-volt"
            : "border-volt/40 text-white hover:border-volt hover:bg-volt/10"
        }`}
      >
        {account.label}
        {/* An inbox nobody notices is an inbox nobody uses. */}
        {unread > 0 && (
          <span
            aria-label={`${unread} unread message${unread === 1 ? "" : "s"}`}
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-volt px-1 text-[10px] font-bold text-ink"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </nav>
  );
}

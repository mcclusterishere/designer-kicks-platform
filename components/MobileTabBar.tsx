"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  // Route prefixes that light this tab up
  match: string[];
  icon: React.ReactNode;
};

// Original marks drawn for the league — not a stock icon set.
function IconSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const TABS: Tab[] = [
  {
    href: "/",
    label: "Home",
    match: ["/"],
    // The heat chart itself: rising bars, the tallest one on fire.
    icon: (
      <IconSvg>
        <path d="M4 20.5h16" />
        <path d="M7.5 20.5V15M12 20.5v-8.5M16.5 20.5V8" />
        <path
          d="M16.5 2.8c1.2 1.4 1.2 2.9 0 3.9-1.2-1-1.2-2.5 0-3.9Z"
          fill="currentColor"
          stroke="none"
        />
      </IconSvg>
    ),
  },
  {
    href: "/battles",
    label: "Arena",
    match: ["/battles", "/tournaments", "/artists", "/heat-list", "/outfits", "/rate"],
    // A tournament bracket: two seeds funnel into the champion line.
    icon: (
      <IconSvg>
        <path d="M3.5 6.5H9M3.5 17.5H9" />
        <path d="M9 6.5V12h4.5M9 17.5V12" />
        <path d="M13.5 12h4" />
        <circle cx="19.8" cy="12" r="1.3" fill="currentColor" stroke="none" />
      </IconSvg>
    ),
  },
  {
    // The exchange takes the center throne — Heat Check lives on in the
    // home feed's game loop (and /quiz still works from there).
    href: "/market",
    label: "Market",
    match: ["/market", "/catalog", "/quiz", "/giveaway", "/collectors", "/shop"],
    icon: null, // center chart renders specially
  },
  {
    href: "/drops",
    label: "Drops",
    match: ["/drops", "/news"],
    // The drop calendar: a marked release day.
    icon: (
      <IconSvg>
        <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
        <path d="M4 10h16M8.5 3v4M15.5 3v4" />
        <circle cx="12" cy="15" r="1.7" fill="currentColor" stroke="none" />
      </IconSvg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    match: ["/profile", "/signin", "/register", "/forgot-password", "/reset-password"],
    // Your closet: a one-of-one on the shelf.
    icon: (
      <IconSvg>
        <path d="M3.5 17.5v-2.2c0-1 .7-1.8 1.7-2 1.9-.3 3.3-1.3 4.3-3.1.4-.8 1.5-1 2.1-.3 1.6 1.7 3.7 2.7 6.6 3.1 1.4.2 2.3 1.2 2.3 2.5v2H3.5Z" />
        <path d="M3.5 17.5c0 1.7 1 2.5 2.5 2.5h12c1.5 0 2.5-.8 2.5-2.5" />
        <path d="M10.5 12.5l1.4 1.2M12.6 10.9l1.5 1.2" />
      </IconSvg>
    ),
  },
];

function isActive(pathname: string, tab: Tab): boolean {
  if (tab.href === "/") return pathname === "/";
  return tab.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

export default function MobileTabBar() {
  const pathname = usePathname();
  // The admin console keeps its own full-width layout.
  if (pathname.startsWith("/admin")) return null;

  // The floating pill dock: a rounded-full glass bar riding above the
  // content, with the active tab as a filled signal-blue circle — the
  // sports-app pattern.
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-4 z-50 md:hidden"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
    >
      <div className="glass mx-auto flex max-w-md items-center justify-around rounded-full border border-white/10 px-2 py-2 shadow-[0_16px_40px_rgba(2,10,20,0.65)]">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          const icon =
            tab.label === "Market" ? (
              // Candlestick chart mark — the exchange.
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M6 4v3M6 13v3" />
                <rect x="4.5" y="7" width="3" height="6" rx="0.8" fill="currentColor" stroke="none" />
                <path d="M12 7v2M12 15v2" />
                <rect x="10.5" y="9" width="3" height="6" rx="0.8" />
                <path d="M18 3v3M18 12v3" />
                <rect x="16.5" y="6" width="3" height="6" rx="0.8" fill="currentColor" stroke="none" />
              </svg>
            ) : (
              tab.icon
            );
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center"
            >
              <span
                className={`flex items-center justify-center rounded-full transition-all duration-200 ${
                  active
                    ? "h-12 w-12 bg-volt text-white shadow-[0_6px_18px_rgba(47,123,255,0.5)]"
                    : "h-12 w-12 text-smoke hover:text-white"
                }`}
              >
                {icon}
              </span>
              {!active && (
                <span className="-mt-1 text-[9px] font-bold uppercase tracking-wide text-smoke/70">
                  {tab.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

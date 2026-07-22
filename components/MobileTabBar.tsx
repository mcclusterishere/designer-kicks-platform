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
    href: "/market",
    label: "Market",
    match: ["/market", "/catalog", "/quiz", "/giveaway", "/collectors", "/shop"],
    // Candlestick chart mark — the exchange.
    icon: (
      <IconSvg>
        <path d="M6 4v3M6 13v3" />
        <rect x="4.5" y="7" width="3" height="6" rx="0.8" fill="currentColor" stroke="none" />
        <path d="M12 7v2M12 15v2" />
        <rect x="10.5" y="9" width="3" height="6" rx="0.8" />
        <path d="M18 3v3M18 12v3" />
        <rect x="16.5" y="6" width="3" height="6" rx="0.8" fill="currentColor" stroke="none" />
      </IconSvg>
    ),
  },
  {
    // The Arena takes the center throne — voting is the whole game.
    href: "/battles",
    label: "Arena",
    match: ["/battles", "/tournaments", "/artists", "/heat-list", "/outfits", "/rate"],
    icon: null, // center mark renders specially
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

  return (
    <nav
      aria-label="Primary"
      className="glass fixed inset-x-0 bottom-0 z-50 border-t border-white/5 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-end justify-around px-2">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          if (tab.label === "Arena") {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label="The Arena — vote on live battles"
                aria-current={active ? "page" : undefined}
                className="relative -top-4 flex flex-col items-center"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition ${
                    active
                      ? "border-volt bg-volt text-ink glow-volt"
                      : "border-heat bg-panel text-heat glow-heat"
                  }`}
                >
                  {/* Crossed blades — two customs, one verdict. */}
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 4.5 16.2 15.7M19 4.5 7.8 15.7" />
                    <path d="M14.7 17.2l2.4-2.4M6.9 14.8l2.4 2.4" />
                    <path d="M5.6 18.4l-1.2 1.2M18.4 18.4l1.2 1.2" />
                    <circle cx="4" cy="20" r="1.2" fill="currentColor" stroke="none" />
                    <circle cx="20" cy="20" r="1.2" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span className={`tag mt-0.5 ${active ? "text-volt" : "text-smoke"}`}>
                  Arena
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 transition ${
                active ? "text-volt" : "text-smoke hover:text-white"
              }`}
            >
              {tab.icon}
              <span className="tag">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

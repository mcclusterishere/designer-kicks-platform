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

function Icon({ d }: { d: string }) {
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
      <path d={d} />
    </svg>
  );
}

const TABS: Tab[] = [
  {
    href: "/",
    label: "Home",
    match: ["/"],
    icon: <Icon d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  },
  {
    href: "/battles",
    label: "Arena",
    match: ["/battles", "/tournaments", "/artists", "/heat-list", "/outfits", "/rate"],
    icon: <Icon d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />,
  },
  {
    href: "/quiz",
    label: "Heat Check",
    match: ["/quiz", "/giveaway"],
    icon: null, // center flame renders specially
  },
  {
    href: "/drops",
    label: "Drops",
    match: ["/drops", "/news"],
    icon: <Icon d="M4 4h13v16H6a2 2 0 0 1-2-2V4Zm13 4h3v10a2 2 0 0 1-2 2M7.5 8.5h6M7.5 12h6M7.5 15.5h6" />,
  },
  {
    href: "/profile",
    label: "Profile",
    match: ["/profile", "/signin", "/register", "/forgot-password", "/reset-password"],
    icon: <Icon d="M12 12a4.2 4.2 0 1 0 0-8.4A4.2 4.2 0 0 0 12 12Zm-7.2 8.4a7.2 7.2 0 0 1 14.4 0" />,
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
          if (tab.label === "Heat Check") {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label="Heat Check quiz"
                className="relative -top-4 flex flex-col items-center"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl transition ${
                    active
                      ? "border-volt bg-volt text-ink glow-volt"
                      : "border-heat bg-panel glow-heat"
                  }`}
                >
                  🔥
                </span>
                <span className={`tag mt-0.5 ${active ? "text-volt" : "text-smoke"}`}>
                  Heat Check
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
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

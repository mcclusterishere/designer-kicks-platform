import type { Metadata } from "next";
import { Geist, Geist_Mono, Bodoni_Moda } from "next/font/google";
import Link from "next/link";
import { auth } from "@/auth";
import { siteUrl } from "@/lib/articles";
import MobileTabBar from "@/components/MobileTabBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fashion-magazine serif for the display type — Vogue-cover energy.
const bodoni = Bodoni_Moda({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "The Heat Chart — Custom Sneaker Battles, Rankings & Drops",
  description:
    "Submit your customized kicks, battle other artists in head-to-head vote-offs, and climb the chart. Plus the hottest releases and customization gear.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Heat Chart",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

const navLinks = [
  { href: "/battles", label: "Battles" },
  { href: "/news", label: "News" },
  { href: "/quiz", label: "Quiz" },
  { href: "/artists", label: "League" },
  { href: "/market", label: "Market" },
  { href: "/heat-list", label: "Heat List" },
  { href: "/submit", label: "Submit" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bodoni.variable} h-full antialiased`}
    >
      {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
        <head>
          <script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        </head>
      )}
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only z-[100] rounded bg-volt px-4 py-2 tag font-bold text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-50 border-b border-edge bg-ink/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="display text-xl text-white">
              The<span className="text-heat">Heat</span>
              <span className="text-volt">Chart</span>
            </Link>
            <nav className="hidden items-center gap-1 sm:gap-2 md:flex">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`tag rounded px-2 py-2 transition sm:px-3 ${
                    l.href === "/submit"
                      ? "bg-volt font-bold text-ink hover:opacity-90"
                      : "text-smoke hover:text-white"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href={session?.user ? "/profile" : "/signin"}
                className="tag rounded border border-edge px-2 py-2 text-white transition hover:border-volt sm:px-3"
              >
                {session?.user ? session.user.name?.split(" ")[0] ?? "Account" : "Sign In"}
              </Link>
            </nav>
            {/* Mobile: tab bar handles navigation; header keeps just the account chip */}
            <Link
              href={session?.user ? "/profile" : "/signin"}
              className="tag rounded border border-edge px-3 py-2 text-white md:hidden"
            >
              {session?.user ? session.user.name?.split(" ")[0] ?? "Account" : "Sign In"}
            </Link>
          </div>
        </header>

        <main id="main" className="flex-1 pb-24 md:pb-0">{children}</main>

        <footer className="border-t border-edge bg-surface">
          <div className="h-1.5 stripes opacity-60" />
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-smoke">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="display text-lg text-white">
                  The<span className="text-heat">Heat</span>
                  <span className="text-volt">Chart</span>
                </p>
                <p className="mt-1 max-w-md">
                  Custom sneaker battles, the Heat List, and the gear to build
                  your next grail. Formerly Designer Kicks.
                </p>
              </div>
              <div className="flex flex-wrap gap-6">
                <Link href="/battles" className="hover:text-white">Battles</Link>
                <Link href="/artists" className="hover:text-white">League</Link>
                <Link href="/heat-list" className="hover:text-white">Heat List</Link>
                <Link href="/news" className="hover:text-white">News</Link>
                <Link href="/drops" className="hover:text-white">Drop Calendar</Link>
                <Link href="/market" className="hover:text-white">Market</Link>
                <Link href="/giveaway" className="hover:text-white">Giveaway</Link>
                <Link href="/shop" className="hover:text-white">Shop</Link>
                <Link href="/admin" className="hover:text-white">Admin</Link>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              <Link href="/terms" className="hover:text-white">Terms</Link>
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/rules" className="hover:text-white">Giveaway Rules</Link>
            </div>
            <p className="mt-6 border-t border-edge pt-4 text-xs">
              Affiliate disclosure: some links on this site are affiliate links.
              We may earn a commission when you buy through them, at no extra
              cost to you. Nike, Jordan, adidas and other brand names belong to
              their respective owners; customs featured here are independent
              artist work and not affiliated with the brands.
            </p>
          </div>
        </footer>
        <MobileTabBar />
      </body>
    </html>
  );
}

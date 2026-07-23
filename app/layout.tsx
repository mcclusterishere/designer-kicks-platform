import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Bodoni_Moda } from "next/font/google";
import Link from "next/link";
import TrackPageview from "@/components/TrackPageview";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import HeaderNav from "@/components/HeaderNav";
import { auth } from "@/auth";
import { siteUrl } from "@/lib/articles";
import { SHOP_LIVE } from "@/lib/flags";
import MobileTabBar from "@/components/MobileTabBar";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import PmaGate from "@/components/PmaGate";
import ThemeToggle from "@/components/ThemeToggle";
import { prisma } from "@/lib/db";
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
  title: "The Heat Chart — Custom Sneaker Culture, Battles & Culture IQ",
  description:
    "Showcase your custom kicks, battle other artists in community vote-offs, climb the Heat List, and build your Culture IQ. A home for custom-sneaker culture — a project of McCluster Corp's Equity Uprise program.",
  manifest: "/manifest.webmanifest",
  // Branded link unfurls everywhere a URL gets dropped — FB, IG DMs,
  // WhatsApp, iMessage. Pages with their own image (articles) override.
  openGraph: {
    type: "website",
    siteName: "The Heat Chart",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "The Heat Chart — Custom Sneaker Battles" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  // Inside the iOS shell: no third-party analytics at all — the app's
  // privacy story stays exactly what the nutrition label says.
  const { headers } = await import("next/headers");
  const inAppShell = ((await headers()).get("user-agent") ?? "").includes("HeatChartApp");
  // Equity Uprise PMA: members who joined through a door with no
  // checkbox (OAuth, pre-association accounts) accept via the gate.
  let needsPma = false;
  if (session?.user?.id) {
    const member = await prisma.user
      .findUnique({ where: { id: session.user.id }, select: { pmaAcceptedAt: true } })
      .catch(() => null);
    needsPma = Boolean(member && !member.pmaAcceptedAt);
  }
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bodoni.variable} h-full antialiased`}
    >
      <head>
        {/* Theme before paint. Default is AUTO: the user's own clock
            decides — light 7am–7pm local, dark at night (device time
            already carries their timezone). A stored light/dark choice
            overrides; runs pre-hydration so there's never a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('thc-theme');if(t!=='light'&&t!=='dark'){var h=new Date().getHours();t=h>=7&&h<19?'light':'dark'}if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}",
          }}
        />
        {!inAppShell && process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}
      </head>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <TrackPageview />
        </Suspense>
        {!inAppShell && <GoogleAnalytics />}
        <a
          href="#main"
          className="sr-only z-[100] rounded btn-hard px-4 py-2 tag font-bold focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to content
        </a>
        <header className="glass sticky top-0 z-50 border-b border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="display text-xl text-white">
              The<span className="text-volt">Heat</span>
              Chart
            </Link>
            <HeaderNav
              account={{
                href: session?.user ? "/profile" : "/signin",
                label: session?.user
                  ? session.user.name?.split(" ")[0] ?? "Account"
                  : "Sign In",
              }}
            />
            {/* Mobile: tab bar handles navigation; header keeps the
                account chip + the day/night switch */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                href={session?.user ? "/profile" : "/signin"}
                className="tag rounded-full border border-volt/40 px-3 py-2 text-white md:hidden"
              >
                {session?.user ? session.user.name?.split(" ")[0] ?? "Account" : "Sign In"}
              </Link>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 pb-24 md:pb-0">{children}</main>
        {needsPma && <PmaGate />}

        <footer className="border-t border-edge bg-surface">
          <div className="h-1.5 stripes opacity-60" />
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-smoke">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="display text-lg text-white">
                  The<span className="text-volt">Heat</span>
                  Chart
                </p>
                <p className="tag mt-2 inline-flex items-center gap-1.5 rounded border border-white/20 px-2.5 py-1 text-white/80">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-volt" />
                  Culture Verified · 1 of 1
                </p>
                <p className="mt-1 max-w-md">
                  Custom-sneaker culture: vote battles, the Heat List, the
                  Culture IQ game, and the independent makers behind it all. A
                  project of McCluster Corp / Equity Uprise; grew out of the
                  Designer Kicks community.
                </p>
              </div>
              <div className="flex flex-wrap gap-6">
                <Link href="/battles" className="hover:text-white">Arena</Link>
                <Link href="/drops" className="hover:text-white">Drops</Link>
                <Link href="/market" className="hover:text-white">Market</Link>
                <Link href="/giveaway" className="hover:text-white">Giveaway</Link>
                {SHOP_LIVE && (
                  <Link href="/shop" className="hover:text-white">Shop</Link>
                )}
                <Link href="/story" className="hover:text-white">Our Story</Link>
                <Link href="/sell" className="hover:text-white">Sell Your Customs</Link>
                <Link href="/careers" className="hover:text-white">Careers</Link>
              </div>
            </div>
            {/* Official channels — set NEXT_PUBLIC_INSTAGRAM_URL /
                _FACEBOOK_URL / _YOUTUBE_URL in Railway; unset = hidden */}
            {(process.env.NEXT_PUBLIC_INSTAGRAM_URL ||
              process.env.NEXT_PUBLIC_FACEBOOK_URL ||
              process.env.NEXT_PUBLIC_YOUTUBE_URL) && (
              <div className="mt-4 flex flex-wrap gap-4">
                {process.env.NEXT_PUBLIC_INSTAGRAM_URL && (
                  <a href={process.env.NEXT_PUBLIC_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="tag text-smoke transition hover:text-volt">
                    Instagram
                  </a>
                )}
                {process.env.NEXT_PUBLIC_FACEBOOK_URL && (
                  <a href={process.env.NEXT_PUBLIC_FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="tag text-smoke transition hover:text-volt">
                    Facebook
                  </a>
                )}
                {process.env.NEXT_PUBLIC_YOUTUBE_URL && (
                  <a href={process.env.NEXT_PUBLIC_YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="tag text-smoke transition hover:text-volt">
                    YouTube
                  </a>
                )}
              </div>
            )}
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
            <p className="mt-3 text-xs">
              © 2026 McCluster Corp · The Heat Chart is a McCluster Corp /
              Equity Uprise project supporting creative opportunity and
              culture education.
              {/* Deploy truth-teller: which commit is this page actually
                  running? Ends every "did it deploy?" debate in 2 seconds. */}
              <span className="ml-2 text-smoke/50">
                build {(process.env.RAILWAY_GIT_COMMIT_SHA ?? "local").slice(0, 7)}
              </span>
            </p>
          </div>
        </footer>
        <MobileTabBar />
        <AddToHomeScreen />
      </body>
    </html>
  );
}

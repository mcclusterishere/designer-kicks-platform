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
import MoneyProvider from "@/components/MoneyProvider";
import CurrencyPicker from "@/components/CurrencyPicker";
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
  title: "The Heat Chart — Sneaker Drops, Live Resale & One-of-One Artwork",
  description:
    "Sneaker culture, all of it: release dates and drop coverage, live resale prices on the pairs everyone's chasing, free games and a weekly fantasy draft — plus the one thing no other platform has, wearable one-of-one artwork from the independent makers who build it. Free to play, free to vote.",
  manifest: "/manifest.webmanifest",
  // Branded link unfurls everywhere a URL gets dropped — FB, IG DMs,
  // WhatsApp, iMessage. Pages with their own image (articles) override.
  openGraph: {
    type: "website",
    siteName: "The Heat Chart",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "The Heat Chart — sneaker drops, live resale, and one-of-one artwork" }],
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
  const { headers, cookies: nextCookies } = await import("next/headers");
  const inAppShell = ((await headers()).get("user-agent") ?? "").includes("HeatChartApp");
  // The reader's money, resolved here so every price below renders in it on
  // the first paint rather than flashing dollars and correcting itself.
  const { resolveMoney } = await import("@/lib/currencyServer");
  const { TZ_COOKIE } = await import("@/lib/currency");
  const money = await resolveMoney();
  const knownTz = (await nextCookies()).get(TZ_COOKIE)?.value ?? null;
  // Equity Uprise PMA: members who joined through a door with no
  // checkbox (OAuth, pre-association accounts) accept via the gate.
  let needsPma = false;
  if (session?.user?.id) {
    const member = await prisma.user
      .findUnique({ where: { id: session.user.id }, select: { pmaAcceptedAt: true } })
      .catch(() => null);
    needsPma = Boolean(member && !member.pmaAcceptedAt);
  }
  const { unreadCount } = await import("@/lib/messages");
  const unread = session?.user?.id ? await unreadCount(session.user.id).catch(() => 0) : 0;
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
              "try{var t=localStorage.getItem('thc-theme2');if(t!=='light'&&t!=='dark'){var h=new Date().getHours();t=h>=7&&h<19?'light':'dark'}if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}",
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
        <MoneyProvider money={money} knownTz={knownTz}>
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
              unread={unread}
            />
            {/* Mobile: tab bar handles navigation; header keeps Post,
                the account chip + the day/night switch.
                Post is here because it went missing. Submit lives in
                HeaderNav, which is `md:flex` — so when the four-door nav
                shipped, phones lost every unconditional route to it. The
                tab bar has five doors and Post isn't one, and both
                fallback links (home, and the end of the vote deck) only
                render when there are no live battles. The healthier the
                arena got, the harder it became to enter it: an artist on
                a phone had to vote through every open battle before a
                submit button appeared. Artists are the supply side of
                this market — their way in cannot be conditional. */}
            <div className="flex items-center gap-2">
              <Link
                href="/submit"
                className="btn-hard tag rounded-full px-3 py-2 font-bold md:hidden"
              >
                ＋ Post
              </Link>
              <ThemeToggle />
              <Link
                href={session?.user ? "/profile" : "/signin"}
                className="relative tag rounded-full border border-volt/40 px-3 py-2 text-white md:hidden"
              >
                {session?.user ? session.user.name?.split(" ")[0] ?? "Account" : "Sign In"}
                {unread > 0 && (
                  <span
                    aria-label={`${unread} unread messages`}
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-volt px-1 text-[10px] font-bold text-ink"
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
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
            {/* Detection is right most of the time and wrong some of the
                time — travellers, VPNs, phones set to another country. The
                picker is the only thing that's always right, so it's here on
                every page rather than buried in settings. */}
            <div className="mt-4 border-t border-edge/60 pt-4">
              <CurrencyPicker />
            </div>
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
        </MoneyProvider>
      </body>
    </html>
  );
}

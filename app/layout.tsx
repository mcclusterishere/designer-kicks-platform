import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Designer Kicks — Custom Sneaker Battles & The Heat List",
  description:
    "Submit your customized kicks, battle other artists in head-to-head vote-offs, and climb the Heat List. Plus the hottest releases and customization gear.",
};

const navLinks = [
  { href: "/battles", label: "Battles" },
  { href: "/heat-list", label: "Heat List" },
  { href: "/shop", label: "Shop" },
  { href: "/submit", label: "Submit" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 border-b border-edge bg-ink/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="display text-xl text-white">
              Designer<span className="text-volt">Kicks</span>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
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
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-edge bg-surface">
          <div className="h-1.5 stripes opacity-60" />
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-smoke">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="display text-lg text-white">
                  Designer<span className="text-volt">Kicks</span>
                </p>
                <p className="mt-1 max-w-md">
                  Custom sneaker battles, the Heat List, and the gear to build
                  your next grail.
                </p>
              </div>
              <div className="flex gap-6">
                <Link href="/battles" className="hover:text-white">Battles</Link>
                <Link href="/heat-list" className="hover:text-white">Heat List</Link>
                <Link href="/shop" className="hover:text-white">Shop</Link>
                <Link href="/admin" className="hover:text-white">Admin</Link>
              </div>
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
      </body>
    </html>
  );
}

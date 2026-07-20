import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "The Shoe Catalog — Every Release, Real SKUs, Community-Rated | The Heat Chart",
  description:
    "Browse the sneaker catalog: real style codes, retail prices, and release dates — rated out of five flames by the culture. The database behind the drop calendar and the battles.",
};
export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;
// For You mixes ~2/3 their lane with ~1/3 wild card per page.
const LANE_TAKE = 32;
const WILD_TAKE = 16;

// Shopping lanes. A signed-in account's "who do you shop for?" preference
// turns on For You — weighted toward their lane, never a wall. The rail
// keeps every exact lane one tap away.
const LANES = [
  { key: "all", label: "Everyone" },
  { key: "mens", label: "Men's" },
  { key: "womens", label: "Women's" },
  { key: "kids", label: "Kids" },
] as const;
type Lane = (typeof LANES)[number]["key"];
type Mode = Lane | "foryou";

function asLane(v: string | undefined | null): Lane | null {
  const g = v?.trim().toLowerCase();
  return LANES.some((l) => l.key === g) ? (g as Lane) : null;
}

function fmtDate(d: Date | null): string | null {
  return d
    ? d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : null;
}

/** 2 lane picks, then a wild card, repeating — the 66/33 deal. */
function weave<T>(laneRows: T[], wildRows: T[]): T[] {
  const out: T[] = [];
  let li = 0, wi = 0;
  while (li < laneRows.length || wi < wildRows.length) {
    for (let k = 0; k < 2 && li < laneRows.length; k++) out.push(laneRows[li++]);
    if (wi < wildRows.length) out.push(wildRows[wi++]);
  }
  return out;
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string; g?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const brand = (sp.brand ?? "").trim().slice(0, 40);
  const page = Math.max(1, Number(sp.page) || 1);

  // Mode resolution: an explicit ?g= tap wins; otherwise a signed-in
  // account with a lane preference lands on For You; everyone else sees all.
  const gRaw = (sp.g ?? "").trim().toLowerCase();
  const explicit: Mode | null = gRaw === "foryou" ? "foryou" : asLane(gRaw);
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  let prefLane: Exclude<Lane, "all"> | null = null;
  let strict = false;
  if (signedIn) {
    const u = await prisma.user.findUnique({
      where: { id: session!.user!.id! },
      select: { shopFor: true, laneStrict: true },
    });
    const p = asLane(u?.shopFor);
    prefLane = p && p !== "all" ? p : null;
    strict = Boolean(u?.laneStrict);
  }
  let mode: Mode = explicit ?? (prefLane ? "foryou" : "all");
  if (mode === "foryou" && !prefLane) mode = "all"; // no preference → nothing to weight

  const baseWhere = {
    imageUrl: { not: null },
    ...(brand ? { brand: { equals: brand, mode: "insensitive" as const } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { sku: { contains: q, mode: "insensitive" as const } },
            { colorway: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const orderBy = [
    { releaseDate: { sort: "desc" as const, nulls: "last" as const } },
    { updatedAt: "desc" as const },
  ];
  const tileSelect = {
    id: true, sku: true, name: true, brand: true,
    imageUrl: true, retailPriceCents: true, marketPriceCents: true, releaseDate: true,
  };
  const brandRailWhere =
    mode === "foryou" || mode === "all"
      ? { imageUrl: { not: null }, brand: { not: null } }
      : { imageUrl: { not: null }, brand: { not: null }, gender: mode };

  let shoes: { id: string; sku: string; name: string; brand: string | null; imageUrl: string | null; retailPriceCents: number | null; marketPriceCents: number | null; releaseDate: Date | null }[];
  let total: number;
  let pages: number;

  if (mode === "foryou" && prefLane && !strict) {
    // The weighted deal: two streams paged in step, woven 2:1.
    const laneWhere = { ...baseWhere, gender: prefLane };
    const wildWhere = { ...baseWhere, NOT: { gender: prefLane } };
    const [laneRows, wildRows, laneTotal, wildTotal] = await Promise.all([
      prisma.catalogShoe.findMany({ where: laneWhere, orderBy, skip: (page - 1) * LANE_TAKE, take: LANE_TAKE, select: tileSelect }),
      prisma.catalogShoe.findMany({ where: wildWhere, orderBy, skip: (page - 1) * WILD_TAKE, take: WILD_TAKE, select: tileSelect }),
      prisma.catalogShoe.count({ where: laneWhere }),
      prisma.catalogShoe.count({ where: wildWhere }),
    ]);
    shoes = weave(laneRows, wildRows);
    total = laneTotal + wildTotal;
    pages = Math.max(1, Math.ceil(laneTotal / LANE_TAKE), Math.ceil(wildTotal / WILD_TAKE));
  } else {
    // Exact lanes (a deliberate rail tap), Everyone, or strict For You.
    const laneFilter =
      mode === "foryou" && prefLane
        ? { gender: prefLane }
        : mode !== "all" && mode !== "foryou"
          ? { gender: mode }
          : {};
    const where = { ...baseWhere, ...laneFilter };
    const [rows, count] = await Promise.all([
      prisma.catalogShoe.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: tileSelect }),
      prisma.catalogShoe.count({ where }),
    ]);
    shoes = rows;
    total = count;
    pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  }

  const brands = await prisma.catalogShoe.groupBy({
    by: ["brand"],
    where: brandRailWhere,
    _count: true,
    orderBy: { _count: { brand: "desc" } },
    take: 8,
  });

  // The culture's flames, batched for just this page of tiles.
  const flames = await prisma.catalogRating.groupBy({
    by: ["shoeId"],
    where: { shoeId: { in: shoes.map((s) => s.id) } },
    _avg: { stars: true },
    _count: true,
  });
  const flameMap = new Map(flames.map((f) => [f.shoeId, f]));

  // One href builder so mode, brand, search, and page always travel together.
  const catHref = (over: { g?: Mode; brand?: string | null; page?: number } = {}) => {
    const g = over.g ?? mode;
    const b = over.brand === undefined ? brand : over.brand ?? "";
    const p = over.page ?? 1;
    const params = new URLSearchParams({
      ...(g !== "all" ? { g } : {}),
      ...(q ? { q } : {}),
      ...(b ? { brand: b } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    }).toString();
    return params ? `/catalog?${params}` : "/catalog";
  };
  const prefLabel = prefLane ? LANES.find((l) => l.key === prefLane)!.label : null;
  const modeLabel = mode === "foryou" ? "For You" : LANES.find((l) => l.key === mode)!.label;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="rule w-16" />
      <h1 className="display mt-2 text-4xl text-white">The Catalog</h1>
      <p className="mt-2 max-w-2xl text-smoke">
        Every release we track — real style codes, retail prices, verified dates.
        The culture rates them in{" "}
        <Link href="/rate" className="text-volt underline">the Rate game</Link>;
        the flames land here.
      </p>

      {/* Who you're shopping for — For You weights toward your lane */}
      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        {prefLane && (
          <Link
            href={catHref({ g: "foryou" })}
            className={`tag rounded-full border px-4 py-2 font-bold transition ${
              mode === "foryou"
                ? "border-heat bg-heat/10 text-heat"
                : "border-edge text-smoke hover:border-heat/50 hover:text-white"
            }`}
          >
            For You
          </Link>
        )}
        {LANES.map((l) => (
          <Link
            key={l.key}
            href={catHref({ g: l.key })}
            className={`tag rounded-full border px-4 py-2 font-bold transition ${
              mode === l.key
                ? "border-heat bg-heat/10 text-heat"
                : "border-edge text-smoke hover:border-heat/50 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        ))}
        {mode === "foryou" && prefLabel && (
          <span className="tag ml-1 text-smoke">
            {strict ? `${prefLabel} only` : `mostly ${prefLabel} + wild cards`} ·{" "}
            <Link href="/profile" className="underline hover:text-white">tune</Link>
          </span>
        )}
      </div>

      {/* Anonymous visitors get the pitch: sign in, get your mix by default */}
      {!signedIn && (
        <div className="mt-4 flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-volt/40 bg-volt/10 px-4 py-3">
          <p className="text-sm text-white">
            <span className="font-bold">Shopping for yourself?</span>{" "}
            <span className="text-smoke">
              Sign in and tell us who you shop for — we&apos;ll deal your lane
              first, every visit.
            </span>
          </p>
          <Link href="/signin" className="btn-hard-volt shrink-0 rounded-lg px-4 py-2 tag font-bold">
            Sign In
          </Link>
        </div>
      )}

      {/* Search + brand rail */}
      <form action="/catalog" className="mt-5 flex max-w-xl gap-2">
        <input
          name="q"
          defaultValue={q}
          maxLength={80}
          placeholder="Search a shoe, SKU, or colorway…"
          className="w-full rounded-lg border border-edge bg-surface px-4 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
        {mode !== "all" && <input type="hidden" name="g" value={mode} />}
        {brand && <input type="hidden" name="brand" value={brand} />}
        <button className="btn-hard rounded-lg px-5 tag font-bold">Search</button>
      </form>
      {brands.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link
            href={catHref({ brand: null })}
            className={`tag rounded-full border px-3 py-1.5 transition ${!brand ? "border-volt text-volt" : "border-edge text-smoke hover:text-white"}`}
          >
            All
          </Link>
          {brands.map((b) => (
            <Link
              key={b.brand}
              href={catHref({ brand: b.brand! })}
              className={`tag rounded-full border px-3 py-1.5 transition ${
                brand.toLowerCase() === b.brand!.toLowerCase()
                  ? "border-volt text-volt"
                  : "border-edge text-smoke hover:text-white"
              }`}
            >
              {b.brand} ({b._count})
            </Link>
          ))}
        </div>
      )}

      {shoes.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-edge bg-surface p-10 text-center">
          <p className="display text-2xl text-white">Nothing here yet</p>
          <p className="mx-auto mt-2 max-w-md text-smoke">
            {q || brand
              ? "No matches — try a different search or clear the brand filter."
              : "The catalog is stocking up. Check the drop calendar meanwhile."}
          </p>
        </div>
      ) : (
        <>
          <p className="mt-6 tag text-smoke">
            {total.toLocaleString()} shoes{mode !== "all" && ` · ${modeLabel}`}{brand && ` · ${brand}`}{q && ` · “${q}”`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shoes.map((s) => {
              const f = flameMap.get(s.id);
              const price = s.marketPriceCents
                ? `≈$${Math.round(s.marketPriceCents / 100)}`
                : s.retailPriceCents
                  ? `$${Math.round(s.retailPriceCents / 100)}`
                  : null;
              return (
                <Link
                  key={s.id}
                  href={`/catalog/${encodeURIComponent(s.sku)}`}
                  className="card-lift group overflow-hidden rounded-xl border border-edge bg-surface"
                >
                  {/* Product PNGs sit whole on a light plate — never square-cropped */}
                  <div className="overflow-hidden bg-[#f2f1ee] p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl!}
                      alt={s.name}
                      loading="lazy"
                      className="aspect-square w-full object-contain transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="p-3">
                    {s.brand && <p className="tag text-smoke">{s.brand}</p>}
                    <p className="mt-0.5 line-clamp-2 text-sm font-bold text-white transition group-hover:text-volt">
                      {s.name}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-volt">
                        {price ?? fmtDate(s.releaseDate) ?? "—"}
                      </span>
                      <span className="text-smoke">
                        {f
                          ? `🔥 ${Math.round((f._avg.stars ?? 0) * 10) / 10} (${f._count})`
                          : fmtDate(s.releaseDate)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              {page > 1 && (
                <Link href={catHref({ page: page - 1 })} className="tag rounded-full border border-edge px-4 py-2 text-smoke hover:border-volt hover:text-white">
                  ← Newer
                </Link>
              )}
              <span className="tag text-smoke">Page {page} of {pages}</span>
              {page < pages && (
                <Link href={catHref({ page: page + 1 })} className="tag rounded-full border border-edge px-4 py-2 text-smoke hover:border-volt hover:text-white">
                  Older →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

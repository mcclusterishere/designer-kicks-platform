import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "The Shoe Catalog — Every Release, Real SKUs, Community-Rated | The Heat Chart",
  description:
    "Browse the sneaker catalog: real style codes, retail prices, and release dates — rated out of five flames by the culture. The database behind the drop calendar and the battles.",
};
export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;

function fmtDate(d: Date | null): string | null {
  return d
    ? d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : null;
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const brand = (sp.brand ?? "").trim().slice(0, 40);
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
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

  const [shoes, total, brands] = await Promise.all([
    prisma.catalogShoe.findMany({
      where,
      orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, sku: true, name: true, brand: true,
        imageUrl: true, retailPriceCents: true, releaseDate: true,
      },
    }),
    prisma.catalogShoe.count({ where }),
    prisma.catalogShoe.groupBy({
      by: ["brand"],
      where: { imageUrl: { not: null }, brand: { not: null } },
      _count: true,
      orderBy: { _count: { brand: "desc" } },
      take: 8,
    }),
  ]);

  // The culture's flames, batched for just this page of tiles.
  const flames = await prisma.catalogRating.groupBy({
    by: ["shoeId"],
    where: { shoeId: { in: shoes.map((s) => s.id) } },
    _avg: { stars: true },
    _count: true,
  });
  const flameMap = new Map(flames.map((f) => [f.shoeId, f]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) =>
    `/catalog?${new URLSearchParams({ ...(q ? { q } : {}), ...(brand ? { brand } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`.replace(/\?$/, "");

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

      {/* Search + brand rail */}
      <form action="/catalog" className="mt-6 flex max-w-xl gap-2">
        <input
          name="q"
          defaultValue={q}
          maxLength={80}
          placeholder="Search a shoe, SKU, or colorway…"
          className="w-full rounded-lg border border-edge bg-surface px-4 py-2.5 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none"
        />
        {brand && <input type="hidden" name="brand" value={brand} />}
        <button className="btn-hard rounded-lg px-5 tag font-bold">Search</button>
      </form>
      {brands.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link
            href={q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog"}
            className={`tag rounded-full border px-3 py-1.5 transition ${!brand ? "border-volt text-volt" : "border-edge text-smoke hover:text-white"}`}
          >
            All
          </Link>
          {brands.map((b) => (
            <Link
              key={b.brand}
              href={`/catalog?brand=${encodeURIComponent(b.brand!)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
          <p className="mt-6 tag text-smoke">{total.toLocaleString()} shoes{brand && ` · ${brand}`}{q && ` · “${q}”`}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shoes.map((s) => {
              const f = flameMap.get(s.id);
              return (
                <Link
                  key={s.id}
                  href={`/catalog/${encodeURIComponent(s.sku)}`}
                  className="card-lift group overflow-hidden rounded-xl border border-edge bg-surface"
                >
                  <div className="overflow-hidden bg-panel">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl!}
                      alt={s.name}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="p-3">
                    {s.brand && <p className="tag text-smoke">{s.brand}</p>}
                    <p className="mt-0.5 line-clamp-2 text-sm font-bold text-white transition group-hover:text-volt">
                      {s.name}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-volt">
                        {s.retailPriceCents ? `$${Math.round(s.retailPriceCents / 100)}` : fmtDate(s.releaseDate) ?? "—"}
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
                <Link href={qs(page - 1)} className="tag rounded-full border border-edge px-4 py-2 text-smoke hover:border-volt hover:text-white">
                  ← Newer
                </Link>
              )}
              <span className="tag text-smoke">Page {page} of {pages}</span>
              {page < pages && (
                <Link href={qs(page + 1)} className="tag rounded-full border border-edge px-4 py-2 text-smoke hover:border-volt hover:text-white">
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

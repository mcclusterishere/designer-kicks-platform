import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buyLinks } from "@/lib/affiliates";

export const dynamic = "force-dynamic";

async function getShoe(sku: string) {
  return prisma.catalogShoe.findUnique({ where: { sku } });
}

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const shoe = await getShoe(decodeURIComponent(sku));
  if (!shoe) return { title: "Shoe not found — The Heat Chart" };
  const retail = shoe.retailPriceCents ? ` — Retail $${Math.round(shoe.retailPriceCents / 100)}` : "";
  return {
    title: `${shoe.name} (${shoe.sku})${retail} | The Heat Chart`,
    description: `${shoe.name} — style code ${shoe.sku}. Release info, retail price, where to buy, and the culture's flame rating on The Heat Chart.`,
  };
}

export default async function CatalogShoePage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const shoe = await getShoe(decodeURIComponent(sku));
  if (!shoe) notFound();

  const [flames, customs] = await Promise.all([
    prisma.catalogRating.aggregate({
      where: { shoeId: shoe.id },
      _avg: { stars: true },
      _count: true,
    }),
    // The bridge back to the league: customs built on this silhouette.
    shoe.silhouette
      ? prisma.submission.findMany({
          where: {
            status: "APPROVED",
            category: "sneakers",
            OR: [
              { silhouette: { equals: shoe.silhouette, mode: "insensitive" } },
              { baseShoe: { equals: shoe.silhouette, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: {
            id: true, title: true, imageUrl: true, artistName: true,
            artist: { select: { slug: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const links = buyLinks(shoe.sku, null, `catalog:${shoe.sku}`);
  const released = shoe.releaseDate
    ? shoe.releaseDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;
  const avg = flames._count > 0 ? Math.round((flames._avg.stars ?? 0) * 10) / 10 : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/catalog" className="tag text-smoke hover:text-white">← The Catalog</Link>

      <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
        {/* Product PNG shown whole on a light plate — no square-crop butchery */}
        <div className="overflow-hidden rounded-2xl border border-edge bg-[#f2f1ee] p-6 sm:p-8">
          {shoe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shoe.imageUrl} alt={shoe.name} className="aspect-square w-full object-contain" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-6xl">👟</div>
          )}
        </div>

        <div>
          {shoe.brand && <p className="tag text-volt">{shoe.brand}</p>}
          <h1 className="display mt-1 text-3xl text-white sm:text-4xl">{shoe.name}</h1>
          <p className="mt-1 font-mono text-sm text-smoke">{shoe.sku}</p>

          {avg !== null && (
            <div className="mt-4 inline-flex items-baseline gap-2 rounded-xl border border-volt/40 bg-volt/10 px-4 py-2.5">
              <span className="display text-3xl text-volt">🔥 {avg}</span>
              <span className="text-sm text-smoke">
                {flames._count} rating{flames._count === 1 ? "" : "s"} from the culture
              </span>
            </div>
          )}

          <dl className="mt-5 space-y-2 border-t border-edge pt-4 text-sm">
            {shoe.silhouette && (
              <div className="flex justify-between gap-4">
                <dt className="text-smoke">Silhouette</dt>
                <dd className="text-white">{shoe.silhouette}</dd>
              </div>
            )}
            {shoe.colorway && (
              <div className="flex justify-between gap-4">
                <dt className="text-smoke">Colorway</dt>
                <dd className="text-white">{shoe.colorway}</dd>
              </div>
            )}
            {shoe.gender && (
              <div className="flex justify-between gap-4">
                <dt className="text-smoke">For</dt>
                <dd className="text-white">
                  {shoe.gender === "womens" ? "Women" : shoe.gender === "kids" ? "Kids" : "Men"}
                </dd>
              </div>
            )}
            {shoe.retailPriceCents && (
              <div className="flex justify-between gap-4">
                <dt className="text-smoke">Retail</dt>
                <dd className="font-bold text-volt">${Math.round(shoe.retailPriceCents / 100)}</dd>
              </div>
            )}
            {released && (
              <div className="flex justify-between gap-4">
                <dt className="text-smoke">Released</dt>
                <dd className="text-white">{released}</dd>
              </div>
            )}
          </dl>

          {links.length > 0 && (
            <div className="mt-5">
              <p className="tag text-smoke">Where to buy</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow sponsored"
                    className="rounded-lg border border-volt/50 px-4 py-2 tag font-bold text-volt transition hover:bg-volt/10"
                  >
                    {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}

          <Link href="/rate" className="btn-hard-volt mt-6 inline-block rounded-xl px-6 py-3 tag font-bold">
            Rate Pairs Like This →
          </Link>
        </div>
      </div>

      {customs.length > 0 && (
        <div className="mt-12">
          <div className="rule w-16" />
          <h2 className="display mt-2 text-2xl text-white">Customs Built On This</h2>
          <p className="mt-1 text-sm text-smoke">
            What the league&apos;s artists did with this silhouette.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {customs.map((c) => (
              <Link
                key={c.id}
                href={c.artist?.slug ? `/artists/${c.artist.slug}` : "/heat-list"}
                className="card-lift group overflow-hidden rounded-xl border border-edge bg-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.imageUrl} alt={`${c.title} by ${c.artistName}`} loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                <div className="p-2.5">
                  <p className="line-clamp-1 text-sm font-bold text-white group-hover:text-volt">{c.title}</p>
                  <p className="tag mt-0.5 text-smoke">{c.artistName}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

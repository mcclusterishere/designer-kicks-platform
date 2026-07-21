import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiResponse, apiOptions, paging, mediaUrl } from "@/lib/publicApi";
import { siteUrl } from "@/lib/articles";
import { estimateValue, VALUATION_DISCLAIMER } from "@/lib/valuation";

export const dynamic = "force-dynamic";

/**
 * The customs database — the dataset nobody else has. Every approved
 * one-of-one piece with its taxonomy, media, collaborators, and the
 * artist's own pricing. This is the feed KicksDB-style aggregators pull.
 */
export async function GET(req: NextRequest) {
  const { limit, offset } = paging(req);
  const p = req.nextUrl.searchParams;
  const category = p.get("category");
  const artistSlug = p.get("artist");

  const where = {
    status: "APPROVED",
    ...(category ? { category } : {}),
    ...(artistSlug ? { artist: { slug: artistSlug } } : {}),
  };

  const [total, pieces] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        artist: { select: { slug: true, displayName: true, status: true } },
        collaborators: { where: { status: "APPROVED" }, select: { slug: true, displayName: true } },
        sales: { where: { status: "CONFIRMED" }, orderBy: { soldAt: "desc" } },
        offers: { where: { status: "OPEN" }, orderBy: { amountCents: "desc" }, take: 1 },
        consignment: { select: { status: true, floorCents: true, priorSaleCents: true, splitPct: true } },
      },
    }),
  ]);

  return apiResponse(req, {
    total,
    count: pieces.length,
    offset,
    customs: pieces.map((s) => {
      const artistUrl =
        s.artist?.status === "APPROVED" ? `${siteUrl()}/artists/${s.artist.slug}` : null;
      return {
        id: s.id,
        title: s.title,
        artist: {
          name: s.artist?.displayName ?? s.artistName,
          slug: s.artist?.status === "APPROVED" ? s.artist.slug : null,
          url: artistUrl,
        },
        collaborators: s.collaborators.map((c) => ({
          name: c.displayName,
          slug: c.slug,
          url: `${siteUrl()}/artists/${c.slug}`,
        })),
        category: s.category,
        base: {
          item: s.baseShoe,
          brand: s.brand,
          silhouette: s.silhouette,
          colorway: s.baseColorway,
        },
        size: s.size,
        description: s.description,
        // ORIGINAL price-discovers on the open market; COMMISSION's
        // first price is a contracted fee. Consumers of this feed
        // should weigh them differently — our estimates do.
        provenance: s.provenanceType,
        consignment:
          s.consignment?.status === "OPEN"
            ? {
                floorUsd: s.consignment.floorCents / 100,
                priorSaleUsd:
                  s.consignment.priorSaleCents !== null ? s.consignment.priorSaleCents / 100 : null,
                consignorSplitPct: s.consignment.splitPct,
              }
            : null,
        images: [mediaUrl(s.imageUrl), ...s.extraImages.map(mediaUrl)].filter(Boolean),
        video: mediaUrl(s.videoUrl),
        pricing: {
          askUsd: s.askingPriceCents !== null ? s.askingPriceCents / 100 : null,
          lastSaleUsd: s.sales[0] ? s.sales[0].priceCents / 100 : null,
          lastSaleVerified: s.sales[0]?.verified ?? false,
          lastSaleAt: s.sales[0]?.soldAt ?? null,
          topOpenOfferUsd: s.offers[0] ? s.offers[0].amountCents / 100 : null,
        },
        valueEstimate: (() => {
          const est = estimateValue({
            provenanceType: s.provenanceType,
            askingPriceCents: s.askingPriceCents,
            verifiedSales: s.sales.filter((x) => x.verified),
            unverifiedSales: s.sales.filter((x) => !x.verified),
            priorConsignmentSaleCents: s.consignment?.priorSaleCents ?? null,
            highBidCents: s.offers[0]?.amountCents ?? null,
          });
          return {
            lowUsd: est.lowCents !== null ? est.lowCents / 100 : null,
            highUsd: est.highCents !== null ? est.highCents / 100 : null,
            confidence: est.confidence,
            basis: est.basis,
            disclaimer: VALUATION_DISCLAIMER,
          };
        })(),
        url: artistUrl ?? `${siteUrl()}/heat-list`,
        createdAt: s.createdAt,
      };
    }),
  });
}

export function OPTIONS() {
  return apiOptions();
}

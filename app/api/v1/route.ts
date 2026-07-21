import { NextRequest } from "next/server";
import { apiResponse, apiOptions, API_VERSION } from "@/lib/publicApi";
import { siteUrl } from "@/lib/articles";

export const dynamic = "force-dynamic";

/** Self-describing index — hit /api/v1 and the API explains itself. */
export async function GET(req: NextRequest) {
  const base = `${siteUrl()}/api/${API_VERSION}`;
  return apiResponse(req, {
    version: API_VERSION,
    endpoints: {
      artists: `${base}/artists — the customizer roster (slug, name, city, IG, piece count)`,
      customs: `${base}/customs — every approved one-of-one piece with images, taxonomy, collaborators, and pricing (?category=, ?artist=, ?limit=, ?offset=)`,
      market: `${base}/market — the customs pricing board: last sales, asks, open offers + index stats`,
      catalog: `${base}/catalog — OG retail releases with live market value and premium vs retail (?brand=, ?q=, ?limit=, ?offset=)`,
    },
    notes: [
      "Read-only. CORS open. 120 req/min per IP; responses cache 5 minutes.",
      "Attribution required: credit The Heat Chart with a link to theheatchart.com wherever this data is displayed.",
    ],
  });
}

export function OPTIONS() {
  return apiOptions();
}

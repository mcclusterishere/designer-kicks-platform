// BETA — Store Scout: prospect local shoe stores straight from the
// admin panel. Search runs against the Google Places API (New) when
// GOOGLE_PLACES_API_KEY is set; each result carries whether the store
// has a website (the ones without are the targets).

export type ScoutedPlace = {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  mapsUrl: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
};

export function placesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

/**
 * Text search, e.g. "sneaker store near 30310". Returns up to 20
 * places with the exact fields the scout board needs. Throws with a
 * readable message on config/API errors so the action can surface it.
 */
export async function searchPlaces(query: string): Promise<ScoutedPlace[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error(
      "Google Places isn't connected — add GOOGLE_PLACES_API_KEY in Railway variables (Places API (New), pay-as-you-go with a monthly free tier)."
    );
  }
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.websiteUri",
        "places.googleMapsUri",
        "places.nationalPhoneNumber",
        "places.rating",
        "places.userRatingCount",
        "places.businessStatus",
      ].join(","),
    },
    body: JSON.stringify({ textQuery: query, pageSize: 20 }),
    // Prospecting is interactive — don't let a slow API hang the panel.
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Places search failed (${res.status}). ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      websiteUri?: string;
      googleMapsUri?: string;
      nationalPhoneNumber?: string;
      rating?: number;
      userRatingCount?: number;
      businessStatus?: string;
    }>;
  };
  return (data.places ?? [])
    .filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY")
    .map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? "Unknown store",
      address: p.formattedAddress ?? null,
      phone: p.nationalPhoneNumber ?? null,
      mapsUrl: p.googleMapsUri ?? null,
      website: p.websiteUri ?? null,
      rating: p.rating ?? null,
      reviewCount: p.userRatingCount ?? null,
    }));
}

/** Zip pulled out of a formatted US address, best effort. */
export function zipFromAddress(address: string | null | undefined): string | null {
  return address?.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? null;
}

export const STORE_STATUSES = ["SCOUTED", "QUALIFIED", "INVITED", "JOINED", "PASSED"] as const;

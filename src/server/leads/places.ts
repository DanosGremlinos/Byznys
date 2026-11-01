// Google Places API (New) client — official API only, never Maps HTML scraping.
// One Text Search request returns up to 20 places with all fields we store (incl. reviews and
// photo references), so no per-place Details calls are needed.
import type { OpeningHours, Weekday } from "@/db/schema/types";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.regularOpeningHours",
  "places.rating",
  "places.userRatingCount",
  "places.primaryTypeDisplayName",
  "places.reviews",
  "places.photos",
  "nextPageToken",
].join(",");

export type PlacesPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; shortText?: string; types: string[] }[];
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: {
    periods?: {
      open: { day: number; hour: number; minute?: number };
      close?: { day: number; hour: number; minute?: number };
    }[];
  };
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text: string };
  reviews?: {
    rating: number;
    text?: { text: string };
    originalText?: { text: string };
    authorAttribution?: { displayName: string };
    publishTime?: string;
  }[];
  photos?: {
    name: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: { displayName: string }[];
  }[];
};

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("Chybí GOOGLE_PLACES_API_KEY");
  return key;
}

export class PlacesApiError extends Error {}

/** Text Search (New), up to `maxPages` pages of 20 results. */
export async function searchPlaces(textQuery: string, maxPages = 3): Promise<PlacesPlace[]> {
  const out: PlacesPlace[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "cs",
        regionCode: "CZ",
        pageSize: 20,
        ...(pageToken ? { pageToken } : {}),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json()) as {
      places?: PlacesPlace[];
      nextPageToken?: string;
      error?: { status?: string; message?: string };
    };
    if (!res.ok)
      throw new PlacesApiError(
        `Places API: ${json.error?.status ?? res.status} ${json.error?.message ?? ""}`.trim(),
      );
    out.push(...(json.places ?? []));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/** Resolves a photo resource name to a short-lived public image URL (no API key in the stored URL). */
export async function resolvePhotoUrl(photoName: string, maxWidthPx = 1200): Promise<string | null> {
  const params = new URLSearchParams({
    maxWidthPx: String(maxWidthPx),
    skipHttpRedirect: "true",
    key: apiKey(),
  });
  const res = await fetch(`https://places.googleapis.com/v1/${photoName}/media?${params}`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { photoUri?: string };
  return json.photoUri ?? null;
}

const DAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const hm = (h: number, m = 0) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

export function mapOpeningHours(p: PlacesPlace["regularOpeningHours"]): OpeningHours | null {
  if (!p?.periods?.length) return null;
  const out: OpeningHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
  for (const period of p.periods) {
    // A period without close means "open 24 hours".
    const close = period.close ? hm(period.close.hour, period.close.minute) : "24:00";
    out[DAYS[period.open.day]]!.push({ open: hm(period.open.hour, period.open.minute), close });
  }
  return out;
}

export function cityOf(place: PlacesPlace): string | null {
  const comps = place.addressComponents ?? [];
  return (
    comps.find((c) => c.types.includes("locality"))?.longText ??
    comps.find((c) => c.types.includes("administrative_area_level_2"))?.longText ??
    null
  );
}

/** Maps a Places result to lead columns (without photos, which need a separate request). */
export function mapPlaceToLead(place: PlacesPlace, category: string) {
  return {
    placeId: place.id,
    name: place.displayName?.text ?? "(bez názvu)",
    category: place.primaryTypeDisplayName?.text ?? category,
    address: place.formattedAddress ?? null,
    city: cityOf(place),
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    websiteUrl: place.websiteUri ?? null,
    googleMapsUrl: place.googleMapsUri ?? null,
    openingHours: mapOpeningHours(place.regularOpeningHours),
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
  };
}

/** Reviews sorted best first (usable as testimonials). */
export function mapReviews(place: PlacesPlace) {
  return (place.reviews ?? [])
    .map((r) => ({
      author: r.authorAttribution?.displayName ?? "Zákazník",
      rating: r.rating,
      text: (r.originalText?.text ?? r.text?.text ?? "").trim(),
      publishedAt: r.publishTime ? new Date(r.publishTime) : null,
    }))
    .filter((r) => r.text.length > 0)
    .sort((a, b) => b.rating - a.rating || b.text.length - a.text.length);
}

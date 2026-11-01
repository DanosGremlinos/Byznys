import { describe, expect, it } from "vitest";
import { mapOpeningHours, mapPlaceToLead, mapReviews, type PlacesPlace } from "@/server/leads/places";

const PLACE: PlacesPlace = {
  id: "ChIJabc",
  displayName: { text: "Pizzerie Napoli" },
  formattedAddress: "Masarykova 12, 602 00 Brno-střed",
  addressComponents: [
    { longText: "Brno", types: ["locality", "political"] },
    { longText: "Jihomoravský kraj", types: ["administrative_area_level_1"] },
  ],
  location: { latitude: 49.19, longitude: 16.61 },
  nationalPhoneNumber: "603 123 456",
  websiteUri: "http://napoli.cz/",
  googleMapsUri: "https://maps.google.com/?cid=1",
  regularOpeningHours: {
    periods: [
      { open: { day: 1, hour: 11, minute: 0 }, close: { day: 1, hour: 22, minute: 0 } },
      { open: { day: 6, hour: 12 }, close: { day: 6, hour: 23, minute: 30 } },
    ],
  },
  rating: 4.6,
  userRatingCount: 412,
  primaryTypeDisplayName: { text: "Pizzerie" },
  reviews: [
    { rating: 3, text: { text: "Průměr" }, authorAttribution: { displayName: "A" } },
    {
      rating: 5,
      originalText: { text: "Nejlepší pizza ve městě!" },
      authorAttribution: { displayName: "B" },
      publishTime: "2026-05-01T10:00:00Z",
    },
    { rating: 5, text: { text: "" } },
  ],
};

describe("Places mapping", () => {
  it("maps a place to lead columns", () => {
    expect(mapPlaceToLead(PLACE, "pizzerie")).toEqual({
      placeId: "ChIJabc",
      name: "Pizzerie Napoli",
      category: "Pizzerie",
      address: "Masarykova 12, 602 00 Brno-střed",
      city: "Brno",
      lat: 49.19,
      lng: 16.61,
      phone: "603 123 456",
      websiteUrl: "http://napoli.cz/",
      googleMapsUrl: "https://maps.google.com/?cid=1",
      openingHours: {
        mon: [{ open: "11:00", close: "22:00" }],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [{ open: "12:00", close: "23:30" }],
        sun: [],
      },
      rating: 4.6,
      reviewCount: 412,
    });
  });

  it("returns null hours when Google has none", () => {
    expect(mapOpeningHours(undefined)).toBeNull();
  });

  it("sorts reviews best first and drops empty ones", () => {
    const r = mapReviews(PLACE);
    expect(r.map((x) => x.author)).toEqual(["B", "A"]);
    expect(r[0].text).toBe("Nejlepší pizza ve městě!");
    expect(r[0].publishedAt?.toISOString()).toBe("2026-05-01T10:00:00.000Z");
  });
});

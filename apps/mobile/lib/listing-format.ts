import { formatSGD } from "@proppy/shared/format";

const BEDROOMS_BY_FLAT_TYPE: Record<string, string> = {
  "1-room": "1 bedroom",
  "2-room": "1 bedroom",
  "3-room": "2 bedrooms",
  "4-room": "3 bedrooms",
  "5-room": "4 bedrooms",
  Executive: "4 bedrooms"
};

export function formatListingPrice(cents: number): string {
  return formatSGD(cents);
}

export function formatAvailableDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function bedroomsForFlatType(flatType: string): string {
  return BEDROOMS_BY_FLAT_TYPE[flatType] ?? "Bedrooms available";
}

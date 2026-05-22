import { format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";
import { formatSGD } from "../../../packages/shared/src/format";

const BEDROOMS_BY_FLAT_TYPE: Record<string, string> = {
  "1-room": "1 bedroom",
  "2-room": "1 bedroom",
  "3-room": "2 bedrooms",
  "4-room": "3 bedrooms",
  "5-room": "4 bedrooms",
  Executive: "4 bedrooms"
};

export { formatSGD };

export function formatAvailableDate(value: string): string {
  return format(parseISO(value), "dd MMM yyyy", { locale: enGB });
}

export function bedroomsForFlatType(flatType: string): string {
  return BEDROOMS_BY_FLAT_TYPE[flatType] ?? "Bedrooms available";
}

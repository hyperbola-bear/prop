import type { CreateListingInput, OnemapSuggestion } from "@proppy/shared/api-client";

export const FLAT_TYPES = [
  "1-room",
  "2-room",
  "3-room",
  "4-room",
  "5-room",
  "Executive"
] as const;
export const FLOOR_BANDS = ["low", "mid", "high"] as const;
export const FURNISHING = ["Unfurnished", "Partial", "Fully"] as const;
export const ROOM_TAGS = [
  "Living",
  "Kitchen",
  "Bedroom",
  "Bathroom",
  "Balcony"
] as const;

export type WizardPhoto = {
  id: string;
  url: string;
  roomTag: string;
  sortOrder: number;
};

export type MandateVia = "agent_mandate" | "agent_no_mandate" | "";

export type ListingDraft = {
  id?: string;
  status?: string;
  propertyType: "hdb" | "";
  title: string;
  description: string;
  ownerUserId: string;
  freeformSellerEmail: string;
  mandateVia: MandateVia;
  block: string;
  street: string;
  postal: string;
  lat: string;
  lng: string;
  addressId: string | undefined;
  blockId: string | undefined;
  flatType: string;
  floorLevelBand: string;
  floorAreaSqft: string;
  monthlyRent: string;
  leaseMonths: string;
  availableFrom: string;
  furnishing: string;
  floorPlanUrl: string;
  floorPlanKey: string;
  photos: WizardPhoto[];
};

export type ListingWizardAction =
  | { type: "patch"; patch: Partial<ListingDraft> }
  | { type: "setPhotos"; photos: WizardPhoto[] }
  | { type: "reset"; draft: ListingDraft };

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function blankListingDraft(): ListingDraft {
  return {
    propertyType: "hdb",
    title: "HDB rental",
    description: "",
    ownerUserId: "",
    freeformSellerEmail: "",
    mandateVia: "",
    block: "",
    street: "",
    postal: "",
    lat: "",
    lng: "",
    addressId: undefined,
    blockId: undefined,
    flatType: "",
    floorLevelBand: "",
    floorAreaSqft: "",
    monthlyRent: "",
    leaseMonths: "12",
    availableFrom: todayIso(),
    furnishing: "",
    floorPlanUrl: "",
    floorPlanKey: "",
    photos: []
  };
}

export function listingWizardReducer(
  state: ListingDraft,
  action: ListingWizardAction
): ListingDraft {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "setPhotos":
      return { ...state, photos: action.photos };
    case "reset":
      return action.draft;
  }
}

export function dollarsToCents(value: string): number {
  return Math.round(Number(value || "0") * 100);
}

export function buildCreateListingPayload(
  draft: ListingDraft,
  isAgent: boolean
): CreateListingInput {
  const payload: CreateListingInput = {
    title: draft.title || "HDB rental",
    description: draft.description,
    priceSgd: dollarsToCents(draft.monthlyRent),
    propertyType: "hdb",
    listingType: "rental"
  };

  if (isAgent && draft.ownerUserId) {
    payload.ownerUserId = draft.ownerUserId;
    payload.mandateVia = draft.mandateVia || "agent_mandate";
  }

  return payload;
}

export function needsAgentMandateStep(
  draft: Pick<ListingDraft, "mandateVia" | "ownerUserId">,
  isAgentNewListing: boolean,
  requestedStep: number
): boolean {
  return isAgentNewListing && requestedStep > 1 && !draft.ownerUserId && !draft.mandateVia;
}

export function missingFieldsForDraft(draft: ListingDraft): string[] {
  const missing: string[] = [];
  if (!draft.addressId || !draft.blockId) missing.push("Address");
  if (!draft.flatType) missing.push("Flat type");
  if (!draft.floorAreaSqft) missing.push("Floor area");
  if (draft.photos.length < 3) missing.push("At least 3 photos required");
  const rent = Number(draft.monthlyRent);
  if (Number.isNaN(rent) || rent < 100 || rent > 50000) {
    missing.push("Monthly rent must be between S$100 and S$50,000");
  }
  if (!draft.leaseMonths) missing.push("Lease months");
  if (!draft.availableFrom) missing.push("Available from date");
  if (!draft.furnishing) missing.push("Furnishing");
  return missing;
}

export function movePhoto(
  photos: WizardPhoto[],
  photoId: string,
  direction: "up" | "down"
): WizardPhoto[] {
  const index = photos.findIndex((photo) => photo.id === photoId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= photos.length) {
    return photos;
  }

  const reordered = [...photos];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, moved!);
  return reordered.map((photo, sortOrder) => ({ ...photo, sortOrder }));
}

export function fallbackSuggestion(input: string): OnemapSuggestion {
  return {
    SEARCHVAL: input,
    BLK_NO: input.match(/\d+/)?.[0] ?? "1",
    ROAD_NAME: input.toUpperCase(),
    BUILDING: "HDB block",
    ADDRESS: `${input}, Singapore 310001`,
    POSTAL: "310001",
    LATITUDE: "1.3343",
    LONGITUDE: "103.8484"
  };
}

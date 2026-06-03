import { describe, expect, it } from "vitest";
import {
  blankListingDraft,
  dollarsToCents,
  listingWizardReducer,
  missingFieldsForDraft,
  movePhoto,
  type WizardPhoto
} from "../listing-wizard";

describe("mobile listing wizard state", () => {
  it("patches draft fields through the reducer", () => {
    const draft = listingWizardReducer(blankListingDraft(), {
      type: "patch",
      patch: { propertyType: "hdb", flatType: "4-room" }
    });

    expect(draft.propertyType).toBe("hdb");
    expect(draft.flatType).toBe("4-room");
  });

  it("requires at least three photos before publish", () => {
    const draft = {
      ...blankListingDraft(),
      addressId: "2d15521a-0b97-4188-b391-3e4d26689e15",
      blockId: "2483f13b-6087-4f02-91b1-05913a29abe7",
      flatType: "4-room",
      floorAreaSqft: "990",
      monthlyRent: "2800",
      furnishing: "Fully",
      photos: []
    };

    expect(missingFieldsForDraft(draft)).toContain("At least 3 photos required");
  });

  it("accepts a complete rental draft", () => {
    const photos: WizardPhoto[] = [0, 1, 2].map((sortOrder) => ({
      id: `00000000-0000-4000-8000-00000000000${sortOrder}`,
      roomTag: "Living",
      sortOrder,
      url: `blob:photo-${sortOrder}`
    }));
    const draft = {
      ...blankListingDraft(),
      addressId: "2d15521a-0b97-4188-b391-3e4d26689e15",
      blockId: "2483f13b-6087-4f02-91b1-05913a29abe7",
      flatType: "4-room",
      floorAreaSqft: "990",
      monthlyRent: "2800",
      furnishing: "Fully",
      photos
    };

    expect(missingFieldsForDraft(draft)).toEqual([]);
  });

  it("moves photos with contiguous sort order for up/down controls", () => {
    const photos: WizardPhoto[] = ["a", "b", "c"].map((id, sortOrder) => ({
      id,
      roomTag: "Living",
      sortOrder,
      url: `blob:${id}`
    }));

    expect(movePhoto(photos, "c", "up").map((photo) => photo.id)).toEqual([
      "a",
      "c",
      "b"
    ]);
    expect(movePhoto(photos, "a", "up")).toBe(photos);
  });

  it("converts dollar inputs to integer cents", () => {
    expect(dollarsToCents("2800")).toBe(280000);
    expect(dollarsToCents("2800.55")).toBe(280055);
  });
});

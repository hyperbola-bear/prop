import { describe, expect, it } from "vitest";
import {
  blankListingDraft,
  buildCreateListingPayload,
  dollarsToCents,
  listingWizardReducer,
  missingFieldsForDraft,
  movePhoto,
  needsAgentMandateStep,
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

  it("adds owner and mandate fields to agent create payloads", () => {
    const sellerId = "2d15521a-0b97-4188-b391-3e4d26689e15";
    const draft = listingWizardReducer(blankListingDraft(), {
      type: "patch",
      patch: {
        ownerUserId: sellerId,
        mandateVia: "agent_mandate",
        monthlyRent: "3200"
      }
    });

    expect(buildCreateListingPayload(draft, true)).toMatchObject({
      ownerUserId: sellerId,
      mandateVia: "agent_mandate",
      priceSgd: 320000
    });
  });

  it("omits mandate fields from non-agent create payloads", () => {
    const draft = listingWizardReducer(blankListingDraft(), {
      type: "patch",
      patch: {
        ownerUserId: "2d15521a-0b97-4188-b391-3e4d26689e15",
        mandateVia: "agent_mandate"
      }
    });

    expect(buildCreateListingPayload(draft, false)).not.toHaveProperty("ownerUserId");
    expect(buildCreateListingPayload(draft, false)).not.toHaveProperty("mandateVia");
  });

  it("requires agent new-listing deep links to visit the mandate step first", () => {
    expect(needsAgentMandateStep(blankListingDraft(), true, 2)).toBe(true);
    expect(
      needsAgentMandateStep(
        { ...blankListingDraft(), ownerUserId: "2d15521a-0b97-4188-b391-3e4d26689e15", mandateVia: "agent_mandate" },
        true,
        2
      )
    ).toBe(false);
    expect(needsAgentMandateStep(blankListingDraft(), false, 2)).toBe(false);
    expect(needsAgentMandateStep(blankListingDraft(), true, 1)).toBe(false);
  });
});

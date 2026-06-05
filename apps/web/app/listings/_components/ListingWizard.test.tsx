import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ListingWizardReview,
  missingFieldsForDraft,
  needsAgentMandateStep,
  type ListingDraft,
  type WizardPhoto
} from "./ListingWizard";

function completePhotos(): WizardPhoto[] {
  return [0, 1, 2].map((sortOrder) => ({
    id: `photo-${sortOrder}`,
    roomTag: "Living",
    sortOrder,
    url: `blob:photo-${sortOrder}`
  }));
}

function completeDraft(overrides: Partial<ListingDraft> = {}): ListingDraft {
  return {
    propertyType: "hdb",
    title: "HDB rental",
    description: "Bright flat near amenities",
    ownerUserId: "",
    freeformSellerEmail: "",
    mandateVia: "",
    block: "123",
    street: "TOA PAYOH LOR 1",
    postal: "310123",
    lat: "1.3343",
    lng: "103.8484",
    addressId: "address-1",
    blockId: "block-1",
    flatType: "4-room",
    floorLevelBand: "mid",
    floorAreaSqft: "990",
    monthlyRent: "2800",
    leaseMonths: "12",
    availableFrom: "2026-06-04",
    furnishing: "Fully",
    floorPlanUrl: "",
    floorPlanKey: "",
    photos: completePhotos(),
    ...overrides
  };
}

describe("web listing wizard missing-fields review", () => {
  it("reports missing photos using the validation-contract wording", () => {
    expect(missingFieldsForDraft(completeDraft({ photos: [] }))).toContain(
      "At least 3 photos required"
    );
  });

  it("accepts a complete rental draft", () => {
    expect(missingFieldsForDraft(completeDraft())).toEqual([]);
  });

  it("renders disabled Publish adjacent to a missing-fields list on incomplete review", () => {
    const html = renderToStaticMarkup(
      <ListingWizardReview
        draft={completeDraft({ photos: [] })}
        errors={{}}
        isBusy={false}
        isEdit={false}
        missingFields={["At least 3 photos required"]}
        onPublish={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="wizard-missing-fields"');
    expect(html).toContain("At least 3 photos required");
    expect(html).toContain('data-testid="wizard-publish"');
    expect(html).toContain("disabled");
  });

  it("keeps agent new listings on the mandate step until owner context is selected", () => {
    expect(needsAgentMandateStep(completeDraft(), true, 2)).toBe(true);
    expect(
      needsAgentMandateStep(
        completeDraft({
          mandateVia: "agent_mandate",
          ownerUserId: "2d15521a-0b97-4188-b391-3e4d26689e15"
        }),
        true,
        2
      )
    ).toBe(false);
    expect(needsAgentMandateStep(completeDraft(), false, 2)).toBe(false);
    expect(needsAgentMandateStep(completeDraft(), true, 0)).toBe(false);
  });
});

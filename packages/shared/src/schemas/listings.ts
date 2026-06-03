import { z } from "zod";

export const listingAddressSchema = z.object({
  block: z.string(),
  street: z.string(),
  postal: z.string(),
  town: z.string()
});

export const listingPhotoSchema = z.object({
  url: z.string().url(),
  alt: z.string().min(1)
});

export const listingSummarySchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  price_sgd: z.number().int().nonnegative(),
  address: listingAddressSchema,
  photos: z.array(listingPhotoSchema),
  listing_type: z.string().min(1),
  property_type: z.string().min(1),
  flat_type: z.string().min(1),
  floor_area_sqft: z.number().int().positive(),
  lease_months: z.number().int().positive(),
  available_from: z.string().min(1)
});

export const agentOrLandlordSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  type: z.enum(["agent", "landlord"])
});

export const listingDetailSchema = listingSummarySchema.extend({
  description: z.string(),
  photos: z.array(listingPhotoSchema),
  floor_plan: z.null(),
  agent_or_landlord: agentOrLandlordSchema
});

export const listingsQuerySchema = z
  .object({
    limit: z
      .string()
      .regex(/^[0-9]+$/, "limit must be a positive integer")
      .optional(),
    cursor: z.string().min(1).optional()
  })
  .transform((value) => {
    const limit = Number(value.limit ?? "20");
    return {
      limit: Math.min(limit, 50),
      cursor: value.cursor ?? null
    };
  })
  .refine((value) => value.limit >= 1, {
    message: "limit must be at least 1",
    path: ["limit"]
  });

export const listingsResponseSchema = z.object({
  items: z.array(listingSummarySchema),
  cursor: z.string().nullable()
});

const centsSchema = z.union([
  z.number().int().nonnegative(),
  z.string().regex(/^[0-9]+$/, "must be a whole number of cents").transform(Number)
]);

const optionalDateSchema = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "must be an ISO date (YYYY-MM-DD)");

export const representedViaSchema = z.enum(["agent_mandate", "agent_no_mandate"]);

export const createListingSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    priceSgd: centsSchema.optional(),
    price_sgd: centsSchema.optional(),
    ownerUserId: z.uuid().optional(),
    mandateVia: representedViaSchema.optional(),
    listingType: z.literal("rental").optional(),
    listing_type: z.literal("rental").optional(),
    propertyType: z.literal("hdb").optional(),
    property_type: z.literal("hdb").optional()
  })
  .transform((value) => ({
    title: value.title,
    description: value.description,
    priceSgd: value.priceSgd ?? value.price_sgd,
    ownerUserId: value.ownerUserId,
    mandateVia: value.mandateVia
  }));

export const patchListingSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    priceSgd: centsSchema.optional(),
    price_sgd: centsSchema.optional(),
    addressId: z.uuid().nullable().optional(),
    address_id: z.uuid().nullable().optional(),
    bedrooms: z.number().int().min(0).max(20).nullable().optional(),
    bathrooms: z.number().int().min(0).max(20).nullable().optional(),
    leaseMonths: z.number().int().min(1).max(36).optional(),
    lease_months: z.number().int().min(1).max(36).optional(),
    availableFrom: optionalDateSchema.optional(),
    available_from: optionalDateSchema.optional(),
    furnishing: z.enum(["Unfurnished", "Partial", "Fully"]).optional(),
    roomOnly: z.boolean().optional(),
    room_only: z.boolean().optional(),
    flatType: z
      .enum(["1-room", "2-room", "3-room", "4-room", "5-room", "Executive"])
      .optional(),
    flat_type: z
      .enum(["1-room", "2-room", "3-room", "4-room", "5-room", "Executive"])
      .optional(),
    flatModel: z.string().trim().max(100).nullable().optional(),
    flat_model: z.string().trim().max(100).nullable().optional(),
    floorLevelBand: z.enum(["low", "mid", "high"]).nullable().optional(),
    floor_level_band: z.enum(["low", "mid", "high"]).nullable().optional(),
    floorAreaSqft: z.number().int().positive().optional(),
    floor_area_sqft: z.number().int().positive().optional(),
    blockId: z.uuid().nullable().optional(),
    block_id: z.uuid().nullable().optional(),
    unitId: z.uuid().nullable().optional(),
    unit_id: z.uuid().nullable().optional()
  })
  .transform((value) => ({
    title: value.title,
    description: value.description,
    priceSgd: value.priceSgd ?? value.price_sgd,
    addressId: value.addressId ?? value.address_id,
    bedrooms: value.bedrooms,
    bathrooms: value.bathrooms,
    leaseMonths: value.leaseMonths ?? value.lease_months,
    availableFrom: value.availableFrom ?? value.available_from,
    furnishing: value.furnishing,
    roomOnly: value.roomOnly ?? value.room_only,
    flatType: value.flatType ?? value.flat_type,
    flatModel: value.flatModel ?? value.flat_model,
    floorLevelBand: value.floorLevelBand ?? value.floor_level_band,
    floorAreaSqft: value.floorAreaSqft ?? value.floor_area_sqft,
    blockId: value.blockId ?? value.block_id,
    unitId: value.unitId ?? value.unit_id
  }));

export const publishListingSchema = z.object({}).optional();

export const uploadContentTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);

export const uploadScopeSchema = z.enum([
  "listing-photo",
  "listing-floor-plan",
  "seller-verification"
]);

export const presignUploadSchema = z.object({
  contentType: uploadContentTypeSchema,
  scope: uploadScopeSchema,
  listingId: z.uuid().optional()
});

export const roomTagSchema = z.enum([
  "Living",
  "Kitchen",
  "Bedroom",
  "Bathroom",
  "Balcony",
  "Exterior",
  "Floor plan"
]);

export const addListingPhotoSchema = z
  .object({
    key: z.string().min(1),
    roomTag: roomTagSchema.optional(),
    room_tag: roomTagSchema.optional(),
    altText: z.string().min(1).max(200).optional(),
    alt_text: z.string().min(1).max(200).optional(),
    caption: z.string().max(500).optional()
  })
  .transform((value) => ({
    key: value.key,
    roomTag: value.roomTag ?? value.room_tag,
    altText: value.altText ?? value.alt_text,
    caption: value.caption
  }));

export const reorderListingPhotosSchema = z.object({
  orderedIds: z.array(z.uuid()).min(1)
});

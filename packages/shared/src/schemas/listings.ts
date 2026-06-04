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
  description: z.string().nullable().optional(),
  price_sgd: z.number().int().nonnegative(),
  address: listingAddressSchema,
  photos: z.array(listingPhotoSchema),
  listing_type: z.string().min(1),
  property_type: z.string().min(1),
  flat_type: z.string().min(1),
  bedrooms: z.number().int().nonnegative().nullable().optional(),
  floor_area_sqft: z.number().int().positive(),
  lease_months: z.number().int().positive(),
  available_from: z.string().min(1),
  furnishing: z.string().min(1).optional(),
  room_only: z.boolean().optional(),
  published_at: z.string().nullable().optional(),
  refreshed_at: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  distance_to_mrt_m: z.number().nonnegative().nullable().optional()
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
    town: z.string().trim().min(1).max(80).optional(),
    flat_type: z
      .enum(["1-room", "2-room", "3-room", "4-room", "5-room", "Executive"])
      .optional(),
    bedrooms: z
      .string()
      .regex(/^[0-9]+$/, "bedrooms must be a non-negative integer")
      .optional(),
    price_min: z
      .string()
      .regex(/^[0-9]+$/, "price_min must be a non-negative whole SGD amount")
      .optional(),
    price_max: z
      .string()
      .regex(/^[0-9]+$/, "price_max must be a non-negative whole SGD amount")
      .optional(),
    lease_min_months: z
      .string()
      .regex(/^[0-9]+$/, "lease_min_months must be a positive integer")
      .optional(),
    available_from: z
      .string()
      .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "available_from must be YYYY-MM-DD")
      .optional(),
    furnishing: z.enum(["Unfurnished", "Partial", "Fully"]).optional(),
    room_only: z.enum(["true", "false"]).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    sort: z.enum(["newest", "price_asc", "price_desc", "refreshed"]).optional(),
    near_mrt: z.string().trim().min(1).max(120).optional(),
    radius_km: z
      .string()
      .regex(/^[0-9]+(?:\.[0-9]+)?$/, "radius_km must be a positive number")
      .optional(),
    view: z.enum(["grid", "map"]).optional(),
    limit: z
      .string()
      .regex(/^[0-9]+$/, "limit must be a positive integer")
      .optional(),
    cursor: z.string().min(1).optional()
  })
  .transform((value) => {
    const limit = Number(value.limit ?? "20");
    const priceMin = value.price_min ? Number(value.price_min) * 100 : undefined;
    const priceMax = value.price_max ? Number(value.price_max) * 100 : undefined;
    const radiusKm = value.radius_km ? Number(value.radius_km) : undefined;
    return {
      town: value.town,
      flat_type: value.flat_type,
      bedrooms: value.bedrooms ? Number(value.bedrooms) : undefined,
      price_min: priceMin,
      price_max: priceMax,
      lease_min_months: value.lease_min_months ? Number(value.lease_min_months) : undefined,
      available_from: value.available_from,
      furnishing: value.furnishing,
      room_only: value.room_only ? value.room_only === "true" : undefined,
      q: value.q,
      sort: value.sort ?? "newest",
      near_mrt: value.near_mrt,
      radius_km: radiusKm,
      view: value.view ?? "grid",
      limit: Math.min(limit, 50),
      cursor: value.cursor ?? null
    };
  })
  .refine((value) => value.limit >= 1, {
    message: "limit must be at least 1",
    path: ["limit"]
  })
  .refine((value) => value.price_min === undefined || value.price_max === undefined || value.price_min <= value.price_max, {
    message: "price_min must be less than or equal to price_max",
    path: ["price_min"]
  })
  .refine((value) => value.radius_km === undefined || value.radius_km > 0, {
    message: "radius_km must be greater than 0",
    path: ["radius_km"]
  });

export const listingsResponseSchema = z.object({
  items: z.array(listingSummarySchema),
  cursor: z.string().nullable()
});

const savedSearchQueryValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const savedSearchQuerySchema = z
  .object({
    town: z.string().trim().min(1).max(80).optional(),
    flat_type: z
      .enum(["1-room", "2-room", "3-room", "4-room", "5-room", "Executive"])
      .optional(),
    bedrooms: z.union([z.number().int().nonnegative(), z.string()]).optional(),
    price_min: z.union([z.number().int().nonnegative(), z.string()]).optional(),
    price_max: z.union([z.number().int().nonnegative(), z.string()]).optional(),
    lease_min_months: z.union([z.number().int().positive(), z.string()]).optional(),
    available_from: z.string().optional(),
    furnishing: z.enum(["Unfurnished", "Partial", "Fully"]).optional(),
    room_only: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    sort: z.enum(["newest", "price_asc", "price_desc", "refreshed"]).optional(),
    near_mrt: z.string().trim().min(1).max(120).optional(),
    radius_km: z.union([z.number().positive(), z.string()]).optional(),
    view: z.enum(["grid", "map"]).optional(),
    limit: z.union([z.number().int().positive(), z.string()]).optional(),
    cursor: z.string().optional()
  })
  .strict()
  .refine((query) => Object.keys(query).length > 0, {
    message: "query must contain at least one supported filter"
  });

export const createSavedSearchSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    query: savedSearchQuerySchema,
    notify_email: z.boolean().optional(),
    notifyEmail: z.boolean().optional()
  })
  .transform((value) => ({
    name: value.name,
    query: value.query as Record<string, z.infer<typeof savedSearchQueryValueSchema>>,
    notifyEmail: value.notifyEmail ?? value.notify_email ?? true
  }));

export const patchSavedSearchSchema = z
  .object({
    notify_email: z.boolean().optional(),
    notifyEmail: z.boolean().optional()
  })
  .transform((value) => ({
    notifyEmail: value.notifyEmail ?? value.notify_email
  }))
  .refine((value) => value.notifyEmail !== undefined, {
    message: "notify_email is required",
    path: ["notify_email"]
  });

export const savedSearchSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  name: z.string().min(1),
  query: z.record(z.string(), savedSearchQueryValueSchema),
  notify_email: z.boolean(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  last_run_at: z.string().nullable().optional()
});

export const savedSearchesResponseSchema = z.object({
  items: z.array(savedSearchSchema)
});

export const favoritesResponseSchema = z.object({
  items: z.array(listingSummarySchema)
});

export const ownedListingSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.string().min(1),
  ownerUserId: z.uuid().optional(),
  agentUserId: z.uuid().nullable().optional(),
  representedVia: z.string().optional(),
  priceSgd: z.number().int().nonnegative(),
  publishedAt: z.string().nullable().optional(),
  refreshedAt: z.string().nullable().optional(),
  rentedAt: z.string().nullable().optional(),
  delistedAt: z.string().nullable().optional(),
  addressId: z.uuid().nullable().optional(),
  block: z.string().nullable(),
  street: z.string().nullable(),
  postal: z.string().nullable().optional(),
  town: z.string().nullable().optional(),
  latitude: z.string().nullable().optional(),
  longitude: z.string().nullable().optional(),
  flatType: z.string().nullable(),
  floorLevelBand: z.string().nullable().optional(),
  floorAreaSqft: z.number().int().nullable().optional(),
  blockId: z.uuid().nullable().optional(),
  leaseMonths: z.number().int().nullable().optional(),
  availableFrom: z.string().nullable().optional(),
  furnishing: z.string().nullable().optional(),
  photoCount: z.number().int().nonnegative().optional()
});

export const ownedListingsResponseSchema = z.object({
  items: z.array(ownedListingSchema)
});

export const ownedListingPhotoSchema = z.object({
  id: z.uuid(),
  objectPath: z.string().min(1),
  thumbnailObjectPath: z.string().min(1).nullable().optional(),
  roomTag: z.string().nullable(),
  sortOrder: z.number().int(),
  url: z.string().url()
});

export const ownedListingDetailSchema = ownedListingSchema.extend({
  photos: z.array(ownedListingPhotoSchema),
  floorPlan: z
    .object({
      id: z.uuid(),
      objectPath: z.string().min(1),
      url: z.string().url()
    })
    .nullable()
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

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export const presignUploadSchema = z.object({
  contentType: uploadContentTypeSchema,
  fileSize: z.number().int().positive().max(MAX_UPLOAD_SIZE_BYTES),
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

export const editableListingPhotoRoomTagSchema = z.enum([
  "Living",
  "Kitchen",
  "Bedroom",
  "Bathroom",
  "Balcony"
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

export const updateListingPhotoRoomTagSchema = z
  .object({
    roomTag: editableListingPhotoRoomTagSchema.optional(),
    room_tag: editableListingPhotoRoomTagSchema.optional()
  })
  .transform((value) => ({
    roomTag: value.roomTag ?? value.room_tag
  }))
  .refine((value) => value.roomTag !== undefined, {
    message: "room_tag is required",
    path: ["room_tag"]
  });

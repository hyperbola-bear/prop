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

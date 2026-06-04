import type { z } from "zod";
import type {
  agentOrLandlordSchema,
  listingAddressSchema,
  listingDetailSchema,
  listingPhotoSchema,
  listingSummarySchema,
  listingsResponseSchema,
  savedSearchSchema,
  savedSearchesResponseSchema,
  ownedListingDetailSchema,
  ownedListingSchema
} from "../schemas/listings";

export type ListingAddress = z.infer<typeof listingAddressSchema>;
export type ListingPhoto = z.infer<typeof listingPhotoSchema>;
export type ListingSummary = z.infer<typeof listingSummarySchema>;
export type ListingDetail = z.infer<typeof listingDetailSchema>;
export type ListingsResponse = z.infer<typeof listingsResponseSchema>;
export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type SavedSearchesResponse = z.infer<typeof savedSearchesResponseSchema>;
export type AgentOrLandlord = z.infer<typeof agentOrLandlordSchema>;
export type OwnedListing = z.infer<typeof ownedListingSchema>;
export type OwnedListingDetail = z.infer<typeof ownedListingDetailSchema>;

import { z } from "zod";

export const agentReviewSchema = z.object({
  stars: z.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(4000)
});

export const agentReviewTypeSchema = z.enum(["verified", "unverified"]);

export const agentProfileReviewSchema = z.object({
  id: z.uuid(),
  stars: z.number().int().min(1).max(5),
  body: z.string(),
  reviewType: agentReviewTypeSchema,
  reviewerName: z.string().nullable(),
  createdAt: z.string().nullable()
});

export const sellerVerificationSchema = z.object({
  documentKey: z.string().trim().min(1).max(1024)
});

export const adminVerificationStatusSchema = z.enum(["approved", "rejected"]);

export const adminReportStatusSchema = z.object({
  status: z.literal("resolved")
});

export const agentProfileResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  photoUrl: z.string().nullable(),
  bio: z.string().nullable(),
  specialties: z.array(z.string()),
  languages: z.array(z.string()),
  listingsCount: z.number().int().nonnegative(),
  responseTime: z.object({
    p50Minutes: z.number().nullable(),
    p90Minutes: z.number().nullable(),
    p50: z.number().nullable(),
    p90: z.number().nullable()
  }),
  verified: z.boolean(),
  reviews: z.array(agentProfileReviewSchema).default([])
});

export type AgentReviewInput = z.infer<typeof agentReviewSchema>;
export type SellerVerificationInput = z.infer<typeof sellerVerificationSchema>;
export type AdminReportStatusInput = z.infer<typeof adminReportStatusSchema>;
export type AgentProfileReview = z.infer<typeof agentProfileReviewSchema>;
export type AgentProfileResponse = z.infer<typeof agentProfileResponseSchema>;

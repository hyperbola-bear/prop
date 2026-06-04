import { z } from "zod";

export const createEnquirySchema = z.object({
  listingId: z.uuid(),
  body: z.string().trim().min(1).max(4000)
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;

export const createConversationMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000)
});

export type CreateConversationMessageInput = z.infer<typeof createConversationMessageSchema>;

export const reportTargetTypeSchema = z.enum(["listing", "message", "agent", "user"]);

export const createReportSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.uuid(),
  reason: z.string().trim().min(1).max(200),
  body: z.string().trim().max(4000).optional().nullable()
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

import { z } from "zod";

export const healthStatusSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  db: z.enum(["ok", "down"]).optional(),
  storage: z.enum(["ok", "down"]).optional(),
  mail: z.enum(["ok", "down"]).optional()
});

export * from "./schemas";
export * from "./types";
export * from "./api-client";
export * from "./format";

import { z } from "zod";

export const okSchema = z.object({
  status: z.literal("ok")
});

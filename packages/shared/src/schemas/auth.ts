import { z } from "zod";

export const authRoleSchema = z.enum(["buyer", "renter", "seller", "landlord", "agent"]);

export const normalizedRoleSchema = z.enum(["buyer", "seller", "agent"]);

export const singaporePhoneSchema = z.string().regex(/^\+65[0-9]{8}$/, {
  message: "Phone must be an E.164 Singapore number starting with +65"
});

export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character");

export const signupSchema = z.object({
  email: z.email(),
  password: strongPasswordSchema,
  phone: singaporePhoneSchema,
  role: authRoleSchema,
  pdpaConsent: z.literal(true, {
    message: "PDPA consent is required"
  }),
  cea_no: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  myinfoPayload: z
    .object({
      name: z.string(),
      uinfin: z.string(),
      nationality: z.string().optional(),
      dob: z.string().optional(),
      sex: z.string().optional(),
      mobileno: z.string().optional()
    })
    .passthrough()
    .optional()
});

export const otpRequestSchema = z.object({
  phone: singaporePhoneSchema
});

export const otpVerifySchema = z.object({
  phone: singaporePhoneSchema,
  code: z.string().regex(/^[0-9]{6}$/, "OTP code must be exactly 6 digits")
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required")
});

export const forgotPasswordSchema = z.object({
  email: z.email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: strongPasswordSchema
});

export const addRoleSchema = z.object({
  role: authRoleSchema
});

export function normalizeRole(role: z.infer<typeof authRoleSchema>): z.infer<typeof normalizedRoleSchema> {
  if (role === "renter") {
    return "buyer";
  }
  if (role === "landlord") {
    return "seller";
  }
  return role;
}

export type SignupInput = z.infer<typeof signupSchema>;
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AddRoleInput = z.infer<typeof addRoleSchema>;

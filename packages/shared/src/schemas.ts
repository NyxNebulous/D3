import { z } from "zod";
import { fulfillmentStates, paymentStates } from "./states.js";

export const mobileNumberSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{9,14}$/, "Enter a valid mobile number");

export const customerNameSchema = z.string().trim().min(1).max(80);

export const qrIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{6,80}$/, "Invalid QR identifier");

export const qrSignatureSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/i, "Invalid QR signature");

export const otpSchema = z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits");

export const positiveIdSchema = z.coerce.number().int().positive();

export const pricePaiseSchema = z.number().int().min(1).max(10_000_000);

export const quantitySchema = z.number().int().min(0).max(99);

export const paymentStateSchema = z.enum(paymentStates);
export const fulfillmentStateSchema = z.enum(fulfillmentStates);

export const qrValidateRequestSchema = z
  .object({
    qrId: qrIdSchema,
    signature: qrSignatureSchema
  })
  .strict();

export const customerLoginSchema = z
  .object({
    name: customerNameSchema,
    mobileNumber: mobileNumberSchema
  })
  .strict();

export const requestOtpSchema = z
  .object({
    name: customerNameSchema,
    mobileNumber: mobileNumberSchema
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    challengeId: z.uuid(),
    otp: otpSchema
  })
  .strict();

export const updateCartItemSchema = z
  .object({
    menuItemId: positiveIdSchema,
    quantity: quantitySchema
  })
  .strict();

export const createOrderSchema = z.object({}).strict();

export const adminLoginSchema = z
  .object({
    username: z.string().trim().min(1).max(80),
    password: z.string().min(1).max(256)
  })
  .strict();

export const menuCategoryCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    sortOrder: z.number().int().min(0).max(10_000).optional()
  })
  .strict();

export const menuCategoryUpdateSchema = menuCategoryCreateSchema.partial().strict();

export const menuItemCreateSchema = z
  .object({
    categoryId: positiveIdSchema,
    name: z.string().trim().min(1).max(120),
    pricePaise: pricePaiseSchema,
    isVeg: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000).optional()
  })
  .strict();

export const menuItemUpdateSchema = menuItemCreateSchema.partial().strict();


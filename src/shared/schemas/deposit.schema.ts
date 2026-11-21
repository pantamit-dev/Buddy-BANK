import { z } from "zod";

export const OcrResultSchema = z.object({
  amount: z.number().positive().nullable(),
  transferDate: z.string().nullable(),
  bankReference: z.string().nullable(),
  bankName: z.string().nullable().optional(),
  rawText: z.string(),
});

export type OcrResult = z.infer<typeof OcrResultSchema>;

export const DepositReviewActionSchema = z.object({
  depositId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reviewerLineUserId: z.string().min(1),
  adjustedAmount: z.number().positive().optional(),
  reason: z.string().optional(),
});

export type DepositReviewAction = z.infer<typeof DepositReviewActionSchema>;

export const DepositQuerySchema = z.object({
  groupId: z.string().uuid().optional(),
  status: z.enum(["pending", "processing", "verified", "rejected", "cancelled"]).optional(),
  memberId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type DepositQuery = z.infer<typeof DepositQuerySchema>;

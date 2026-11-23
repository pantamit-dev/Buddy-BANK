import { z } from "zod";

export const WithdrawalQuerySchema = z.object({
  groupId: z.string().uuid("Invalid groupId"),
  status: z
    .enum(["pending_vote", "approved", "rejected", "cancelled", "paid"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CreateWithdrawalSchema = z.object({
  groupId: z.string().uuid("Invalid groupId"),
  requesterLineUserId: z.string().min(1, "requesterLineUserId is required"),
  amount: z.coerce.number().positive("จำนวนเงินต้องมากกว่า 0"),
  purpose: z.string().trim().min(1, "กรุณาระบุวัตถุประสงค์การเบิก").max(500),
  receiptStoragePath: z.string().optional().nullable(),
  votingDurationHours: z.coerce.number().int().min(1).max(168).optional(),
});

export const VoteWithdrawalActionSchema = z.object({
  action: z.literal("vote").optional().default("vote"),
  withdrawalId: z.string().uuid("Invalid withdrawalId"),
  voterLineUserId: z.string().min(1, "voterLineUserId is required"),
  choice: z.enum(["approve", "reject"]),
});

export const CancelWithdrawalActionSchema = z.object({
  action: z.literal("cancel"),
  withdrawalId: z.string().uuid("Invalid withdrawalId"),
  actorLineUserId: z.string().min(1, "actorLineUserId is required"),
});

export type WithdrawalQueryInput = z.infer<typeof WithdrawalQuerySchema>;
export type CreateWithdrawalInput = z.infer<typeof CreateWithdrawalSchema>;
export type VoteWithdrawalActionInput = z.infer<typeof VoteWithdrawalActionSchema>;
export type CancelWithdrawalActionInput = z.infer<typeof CancelWithdrawalActionSchema>;

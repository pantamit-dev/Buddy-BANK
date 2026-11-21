import { z } from "zod";

export const RuleTypeEnum = z.enum(["monthly_fixed", "flexible_target", "pay_as_you_go"]);
export const ExcessHandlingEnum = z.enum(["rollover", "refund", "donation"]);

export const FinancialRulesSchema = z.object({
  rule_type: RuleTypeEnum.default("monthly_fixed"),
  minimum_deposit: z.number().min(0).default(0),
  monthly_due_day: z.number().int().min(1).max(31).default(28),
  monthly_amount: z.number().min(0).default(0),
  excess_handling: ExcessHandlingEnum.default("rollover"),
  grace_period_days: z.number().int().min(0).default(3),
});

export type GroupFinancialRules = z.infer<typeof FinancialRulesSchema>;

export type MemberComplianceStatus = "on_track" | "due_soon" | "overdue" | "completed";

export interface MemberComplianceEvaluation {
  status: MemberComplianceStatus;
  amountPaid: number;
  amountRequired: number;
  remainingDue: number;
  excessAmount: number;
  dueDate: string;
  isGracePeriod: boolean;
  message: string;
}

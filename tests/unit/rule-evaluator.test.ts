import { describe, it, expect } from "vitest";
import { RuleEvaluatorService } from "@/modules/rules/evaluator";
import { FinancialRulesSchema } from "@/modules/rules/schema";

describe("Financial Rules Engine & Evaluator Unit Tests", () => {
  const evaluator = new RuleEvaluatorService();

  describe("Zod Financial Rules Schema Validation", () => {
    it("parses valid rules and applies standard defaults", () => {
      const parsed = FinancialRulesSchema.parse({});

      expect(parsed.rule_type).toBe("monthly_fixed");
      expect(parsed.minimum_deposit).toBe(0);
      expect(parsed.monthly_due_day).toBe(28);
      expect(parsed.grace_period_days).toBe(3);
      expect(parsed.excess_handling).toBe("rollover");
    });

    it("accepts custom valid configuration", () => {
      const parsed = FinancialRulesSchema.parse({
        rule_type: "flexible_target",
        minimum_deposit: 100,
        monthly_due_day: 15,
        monthly_amount: 3000,
        grace_period_days: 5,
        excess_handling: "refund",
      });

      expect(parsed.rule_type).toBe("flexible_target");
      expect(parsed.monthly_due_day).toBe(15);
      expect(parsed.monthly_amount).toBe(3000);
      expect(parsed.grace_period_days).toBe(5);
    });

    it("rejects invalid due dates (day > 31)", () => {
      expect(() =>
        FinancialRulesSchema.parse({
          monthly_due_day: 32,
        })
      ).toThrow();
    });

    it("rejects negative minimum deposit amounts", () => {
      expect(() =>
        FinancialRulesSchema.parse({
          minimum_deposit: -50,
        })
      ).toThrow();
    });
  });

  describe("Member Compliance Evaluation", () => {
    const standardRules = FinancialRulesSchema.parse({
      monthly_amount: 2500,
      monthly_due_day: 25,
      grace_period_days: 3,
      excess_handling: "rollover",
    });

    it("returns 'completed' when member paid target amount in full", () => {
      const result = evaluator.evaluateMember({
        rules: standardRules,
        paidAmount: 2500,
        asOfDate: new Date(2026, 10, 10), // Nov 10
        year: 2026,
        month: 10,
      });

      expect(result.status).toBe("completed");
      expect(result.remainingDue).toBe(0);
      expect(result.excessAmount).toBe(0);
    });

    it("calculates excess payment rollover when member overpays", () => {
      const result = evaluator.evaluateMember({
        rules: standardRules,
        paidAmount: 3500, // 1000 excess
        asOfDate: new Date(2026, 10, 10),
        year: 2026,
        month: 10,
      });

      expect(result.status).toBe("completed");
      expect(result.excessAmount).toBe(1000);
      expect(result.message).toContain("ยกยอด");
    });

    it("returns 'on_track' when paid partial and due date is far away (> 3 days)", () => {
      const result = evaluator.evaluateMember({
        rules: standardRules,
        paidAmount: 1000,
        asOfDate: new Date(2026, 10, 10), // Nov 10, due Nov 25 -> 15 days away
        year: 2026,
        month: 10,
      });

      expect(result.status).toBe("on_track");
      expect(result.remainingDue).toBe(1500);
      expect(result.isGracePeriod).toBe(false);
    });

    it("returns 'due_soon' when due date is approaching (within 3 days)", () => {
      const result = evaluator.evaluateMember({
        rules: standardRules,
        paidAmount: 1000,
        asOfDate: new Date(2026, 10, 23), // Nov 23, due Nov 25 -> 2 days away
        year: 2026,
        month: 10,
      });

      expect(result.status).toBe("due_soon");
      expect(result.remainingDue).toBe(1500);
      expect(result.isGracePeriod).toBe(false);
    });

    it("returns 'due_soon' with isGracePeriod=true when within grace period", () => {
      const result = evaluator.evaluateMember({
        rules: standardRules,
        paidAmount: 1000,
        asOfDate: new Date(2026, 10, 27), // Nov 27, due Nov 25 + 3 days grace = Nov 28
        year: 2026,
        month: 10,
      });

      expect(result.status).toBe("due_soon");
      expect(result.isGracePeriod).toBe(true);
      expect(result.message).toContain("Grace Period");
    });

    it("returns 'overdue' when after grace period has elapsed", () => {
      const result = evaluator.evaluateMember({
        rules: standardRules,
        paidAmount: 1000,
        asOfDate: new Date(2026, 10, 30), // Nov 30, grace ended Nov 28
        year: 2026,
        month: 10,
      });

      expect(result.status).toBe("overdue");
      expect(result.remainingDue).toBe(1500);
      expect(result.message).toContain("เกินกำหนดชำระแล้ว");
    });
  });
});

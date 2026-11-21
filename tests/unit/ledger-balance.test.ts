import { describe, it, expect } from "vitest";
import {
  calculateBalanceSummary,
  calculateMemberContribution,
  computeNextRunningBalance,
} from "@/modules/ledger/balance";

describe("Ledger Financial Calculations Unit Tests", () => {
  describe("calculateBalanceSummary", () => {
    it("calculates balance correctly with credits and debits", () => {
      const entries = [
        { entry_type: "credit", amount: 1000.0 },
        { entry_type: "credit", amount: 500.5 },
        { entry_type: "debit", amount: 200.0 },
      ];
      const target = 5000.0;

      const summary = calculateBalanceSummary(entries, target);

      expect(summary.totalCredit).toBe(1500.5);
      expect(summary.totalDebit).toBe(200.0);
      expect(summary.totalBalance).toBe(1300.5);
      expect(summary.remainingAmount).toBe(3699.5);
      expect(summary.percentage).toBe(26.01);
    });

    it("handles zero target without division by zero errors", () => {
      const entries = [{ entry_type: "credit", amount: 1000.0 }];
      const summary = calculateBalanceSummary(entries, 0);

      expect(summary.totalBalance).toBe(1000.0);
      expect(summary.percentage).toBe(0);
      expect(summary.remainingAmount).toBe(0);
    });

    it("handles empty entries list", () => {
      const summary = calculateBalanceSummary([], 10000);
      expect(summary.totalBalance).toBe(0);
      expect(summary.totalCredit).toBe(0);
      expect(summary.totalDebit).toBe(0);
      expect(summary.percentage).toBe(0);
      expect(summary.remainingAmount).toBe(10000);
    });

    it("caps remaining amount at 0 when goal is exceeded", () => {
      const entries = [{ entry_type: "credit", amount: 15000.0 }];
      const summary = calculateBalanceSummary(entries, 10000);

      expect(summary.totalBalance).toBe(15000.0);
      expect(summary.remainingAmount).toBe(0);
      expect(summary.percentage).toBe(150.0);
    });
  });

  describe("calculateMemberContribution", () => {
    it("calculates individual share percentage accurately", () => {
      const entries = [
        { member_id: "m1", entry_type: "credit", amount: 2000.0 },
        { member_id: "m2", entry_type: "credit", amount: 3000.0 },
        { member_id: "m1", entry_type: "credit", amount: 1000.0 },
      ];

      const m1Contribution = calculateMemberContribution(entries, "m1");
      expect(m1Contribution.personalTotal).toBe(3000.0);
      expect(m1Contribution.personalSharePercentage).toBe(50.0);

      const m2Contribution = calculateMemberContribution(entries, "m2");
      expect(m2Contribution.personalTotal).toBe(3000.0);
      expect(m2Contribution.personalSharePercentage).toBe(50.0);
    });

    it("returns zero when member has made no contributions", () => {
      const entries = [
        { member_id: "m1", entry_type: "credit", amount: 2000.0 },
      ];
      const contribution = calculateMemberContribution(entries, "m999");
      expect(contribution.personalTotal).toBe(0);
      expect(contribution.personalSharePercentage).toBe(0);
    });
  });

  describe("computeNextRunningBalance", () => {
    it("adds credit to current balance", () => {
      const next = computeNextRunningBalance(1000.0, "credit", 500.25);
      expect(next).toBe(1500.25);
    });

    it("subtracts debit from current balance", () => {
      const next = computeNextRunningBalance(1500.25, "debit", 300.0);
      expect(next).toBe(1200.25);
    });

    it("throws error if negative amount is supplied", () => {
      expect(() => {
        computeNextRunningBalance(1000, "credit", -50);
      }).toThrow();
    });
  });
});

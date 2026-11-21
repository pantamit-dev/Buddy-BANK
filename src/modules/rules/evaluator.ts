import {
  GroupFinancialRules,
  FinancialRulesSchema,
  MemberComplianceEvaluation,
  MemberComplianceStatus,
} from "./schema";

export class RuleEvaluatorService {
  /**
   * Validates and parses a raw JSON rules object against FinancialRulesSchema
   */
  static parseRules(raw: any): GroupFinancialRules {
    return FinancialRulesSchema.parse(raw || {});
  }

  /**
   * Evaluates a member's compliance for a specific monthly cycle
   */
  evaluateMember(params: {
    rules: GroupFinancialRules;
    paidAmount: number;
    asOfDate?: Date;
    year?: number;
    month?: number; // 0-indexed (0 = Jan, 11 = Dec)
  }): MemberComplianceEvaluation {
    const { rules, paidAmount } = params;
    const now = params.asOfDate || new Date();
    const year = params.year ?? now.getFullYear();
    const month = params.month ?? now.getMonth();

    const monthlyRequired = rules.monthly_amount;
    const dueDay = Math.min(rules.monthly_due_day, new Date(year, month + 1, 0).getDate());
    const dueDate = new Date(year, month, dueDay, 23, 59, 59);

    const graceDays = rules.grace_period_days || 0;
    const gracePeriodEnd = new Date(dueDate.getTime() + graceDays * 24 * 60 * 60 * 1000);

    const remainingDue = Math.max(0, monthlyRequired - paidAmount);
    const excessAmount = Math.max(0, paidAmount - monthlyRequired);

    let status: MemberComplianceStatus = "on_track";
    let isGracePeriod = false;
    let message = "";

    if (monthlyRequired <= 0) {
      // No fixed requirement
      status = "completed";
      message = "ไม่มีกำหนดยอดขั้นต่ำประจำเดือน";
    } else if (paidAmount >= monthlyRequired) {
      status = "completed";
      if (excessAmount > 0 && rules.excess_handling === "rollover") {
        message = `ชำระครบถ้วนแล้ว (มียอดเงินยกยอดไปเดือนหน้า ฿${excessAmount.toLocaleString()})`;
      } else {
        message = "ชำระเงินตามเป้าหมายประจำเดือนครบถ้วนแล้ว";
      }
    } else {
      // Underpaid
      if (now.getTime() <= dueDate.getTime()) {
        const msRemaining = dueDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
        if (daysRemaining <= 3) {
          status = "due_soon";
          message = `ใกล้ถึงกำหนดชำระ (เหลืออีก ${daysRemaining} วัน) ยังขาดอีก ฿${remainingDue.toLocaleString()}`;
        } else {
          status = "on_track";
          message = `อยู่ในกำหนดชำระ (เหลืออีก ${daysRemaining} วัน) ค้างชำระ ฿${remainingDue.toLocaleString()}`;
        }
      } else if (now.getTime() <= gracePeriodEnd.getTime()) {
        status = "due_soon";
        isGracePeriod = true;
        const msGraceRemaining = gracePeriodEnd.getTime() - now.getTime();
        const daysGraceRemaining = Math.ceil(msGraceRemaining / (1000 * 60 * 60 * 24));
        message = `อยู่ในช่วงผ่อนผัน (Grace Period เหลือ ${daysGraceRemaining} วัน) ขาดอีก ฿${remainingDue.toLocaleString()}`;
      } else {
        status = "overdue";
        const msOverdue = now.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(msOverdue / (1000 * 60 * 60 * 24));
        message = `เกินกำหนดชำระแล้ว ${daysOverdue} วัน! ขาดอีก ฿${remainingDue.toLocaleString()}`;
      }
    }

    return {
      status,
      amountPaid: paidAmount,
      amountRequired: monthlyRequired,
      remainingDue,
      excessAmount,
      dueDate: dueDate.toISOString().split("T")[0],
      isGracePeriod,
      message,
    };
  }
}

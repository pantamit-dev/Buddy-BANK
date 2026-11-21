export interface BalanceSummary {
  totalBalance: number;
  totalCredit: number;
  totalDebit: number;
  targetAmount: number;
  percentage: number;
  remainingAmount: number;
}

export interface EntryInput {
  entry_type: "credit" | "debit" | string;
  amount: number | string;
  member_id?: string;
}

/**
 * Calculates financial pool summary from ledger entries
 */
export function calculateBalanceSummary(
  entries: EntryInput[],
  targetAmount: number = 0
): BalanceSummary {
  let totalCredit = 0;
  let totalDebit = 0;

  for (const entry of entries) {
    const val = Number(entry.amount) || 0;
    if (entry.entry_type === "credit") {
      totalCredit += val;
    } else if (entry.entry_type === "debit") {
      totalDebit += val;
    }
  }

  const totalBalance = Math.round((totalCredit - totalDebit) * 100) / 100;
  const target = Math.max(0, Number(targetAmount) || 0);
  const percentage = target > 0 ? Math.round(((totalBalance / target) * 100) * 100) / 100 : 0;
  const remainingAmount = Math.max(0, Math.round((target - totalBalance) * 100) / 100);

  return {
    totalBalance,
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalDebit: Math.round(totalDebit * 100) / 100,
    targetAmount: target,
    percentage,
    remainingAmount,
  };
}

/**
 * Calculates the personal credited total for a given member
 */
export function calculateMemberContribution(
  entries: EntryInput[],
  memberId: string
): { personalTotal: number; personalSharePercentage: number } {
  let personalTotal = 0;
  let poolCredit = 0;

  for (const entry of entries) {
    const val = Number(entry.amount) || 0;
    if (entry.entry_type === "credit") {
      poolCredit += val;
      if (entry.member_id === memberId) {
        personalTotal += val;
      }
    }
  }

  const share = poolCredit > 0 ? (personalTotal / poolCredit) * 100 : 0;

  return {
    personalTotal: Math.round(personalTotal * 100) / 100,
    personalSharePercentage: Math.round(share * 100) / 100,
  };
}

/**
 * Computes next running balance given an existing balance and a new entry
 */
export function computeNextRunningBalance(
  currentBalance: number,
  entryType: "credit" | "debit",
  amount: number
): number {
  if (amount < 0) {
    throw new Error("Amount must be positive");
  }
  const delta = entryType === "credit" ? amount : -amount;
  return Math.round((currentBalance + delta) * 100) / 100;
}

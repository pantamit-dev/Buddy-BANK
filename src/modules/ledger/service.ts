import { createAdminClient } from "@/integrations/supabase/server";
import {
  calculateBalanceSummary,
  calculateMemberContribution,
  computeNextRunningBalance,
  type BalanceSummary,
} from "./balance";

export class LedgerService {
  constructor(private supabase = createAdminClient()) {}

  /**
   * Commits an atomic financial transaction and ledger entry for a verified deposit
   */
  async recordVerifiedDeposit(params: {
    groupId: string;
    depositId: string;
    memberId: string;
    amount: number;
    actorProfileId?: string | null;
  }) {
    const { groupId, depositId, memberId, amount, actorProfileId } = params;

    if (amount <= 0) {
      throw new Error("Deposit amount must be positive");
    }

    // 1. Fetch latest ledger entry to get current running balance
    const { data: latestEntry } = await this.supabase
      .from("ledger_entries")
      .select("running_balance")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentRunningBalance = Number(latestEntry?.running_balance || 0);
    const newRunningBalance = computeNextRunningBalance(
      currentRunningBalance,
      "credit",
      amount
    );

    // 2. Insert into transactions table
    const { data: transaction, error: txError } = await this.supabase
      .from("transactions")
      .insert({
        group_id: groupId,
        deposit_id: depositId,
        amount,
        transaction_type: "deposit",
      })
      .select()
      .single();

    if (txError) {
      throw txError;
    }

    // 3. Insert append-only ledger entry
    const { data: ledgerEntry, error: ledgerError } = await this.supabase
      .from("ledger_entries")
      .insert({
        transaction_id: transaction.id,
        group_id: groupId,
        member_id: memberId,
        entry_type: "credit",
        amount,
        running_balance: newRunningBalance,
      })
      .select()
      .single();

    if (ledgerError) {
      // Clean up orphaned transaction to allow clean retry
      await this.supabase.from("transactions").delete().eq("id", transaction.id);
      throw ledgerError;
    }

    // 4. Log to audit_logs
    await this.supabase.from("audit_logs").insert({
      group_id: groupId,
      actor_id: actorProfileId || null,
      action: "DEPOSIT_VERIFIED_LEDGER_CREDIT",
      entity_name: "ledger_entries",
      entity_id: ledgerEntry.id,
      payload: {
        deposit_id: depositId,
        amount,
        running_balance: newRunningBalance,
      },
    });

    return {
      transaction,
      ledgerEntry,
      newRunningBalance,
    };
  }

  /**
   * Queries group balance summary
   */
  async getGroupBalanceSummary(groupId: string): Promise<BalanceSummary> {
    const { data: group } = await this.supabase
      .from("groups")
      .select("target_amount")
      .eq("id", groupId)
      .single();

    const { data: entries } = await this.supabase
      .from("ledger_entries")
      .select("entry_type, amount, member_id")
      .eq("group_id", groupId);

    const targetAmount = Number(group?.target_amount || 0);
    return calculateBalanceSummary(entries || [], targetAmount);
  }

  /**
   * Queries individual member contribution in a group
   */
  async getMemberContribution(groupId: string, memberId: string) {
    const { data: entries } = await this.supabase
      .from("ledger_entries")
      .select("entry_type, amount, member_id")
      .eq("group_id", groupId);

    return calculateMemberContribution(entries || [], memberId);
  }
}

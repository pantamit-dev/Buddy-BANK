import { createAdminClient } from "@/integrations/supabase/server";
import { LedgerService } from "@/modules/ledger/service";

export interface ToolContext {
  groupId: string;
  supabase?: any;
}

export class AiBusinessTools {
  private ledgerService: LedgerService;

  constructor(private supabase = createAdminClient()) {
    this.ledgerService = new LedgerService(this.supabase);
  }

  /**
   * Fetches high-level group progress toward the savings goal
   */
  async getGroupProgress(groupId: string) {
    const balance = await this.ledgerService.getGroupBalance(groupId);
    return {
      groupName: balance.groupName,
      targetAmount: balance.targetAmount,
      currentBalance: balance.currentBalance,
      progressPercentage: balance.progressPercentage,
      contributingMembersCount: balance.contributingMembersCount,
      totalMembersCount: balance.totalMembersCount,
      isGoalReached: balance.currentBalance >= balance.targetAmount && balance.targetAmount > 0,
      remainingAmount: Math.max(0, balance.targetAmount - balance.currentBalance),
    };
  }

  /**
   * Fetches overall balance and transaction breakdown
   */
  async getGroupBalance(groupId: string) {
    const { data: group } = await this.supabase
      .from("groups")
      .select("name, target_amount")
      .eq("id", groupId)
      .maybeSingle();

    const { data: ledgerEntries } = await this.supabase
      .from("ledger_entries")
      .select("amount, entry_type")
      .eq("group_id", groupId);

    let totalCredits = 0;
    let totalDebits = 0;

    if (ledgerEntries) {
      for (const entry of ledgerEntries) {
        if (entry.entry_type === "credit") {
          totalCredits += Number(entry.amount);
        } else if (entry.entry_type === "debit") {
          totalDebits += Number(entry.amount);
        }
      }
    }

    const currentBalance = totalCredits - totalDebits;

    return {
      groupName: group?.name || "กองกลาง",
      currentBalance,
      totalDeposited: totalCredits,
      totalWithdrawn: totalDebits,
      targetAmount: Number(group?.target_amount || 0),
    };
  }

  /**
   * Lists members who have not yet deposited or contributed to the pool
   */
  async getUnpaidMembers(groupId: string) {
    const { data: members } = await this.supabase
      .from("group_members")
      .select("id, role, status, profiles(display_name)")
      .eq("group_id", groupId)
      .eq("status", "active");

    const { data: paidDeposits } = await this.supabase
      .from("deposits")
      .select("member_id")
      .eq("group_id", groupId)
      .eq("status", "verified");

    const paidMemberIds = new Set((paidDeposits || []).map((d) => d.member_id));
    const activeMembers = members || [];

    const unpaidMembers = activeMembers
      .filter((m) => !paidMemberIds.has(m.id))
      .map((m: any) => ({
        memberId: m.id,
        displayName: m.profiles?.display_name || "สมาชิก",
        role: m.role,
      }));

    const paidMembers = activeMembers
      .filter((m) => paidMemberIds.has(m.id))
      .map((m: any) => ({
        memberId: m.id,
        displayName: m.profiles?.display_name || "สมาชิก",
        role: m.role,
      }));

    return {
      unpaidCount: unpaidMembers.length,
      paidCount: paidMembers.length,
      totalActiveMembers: activeMembers.length,
      unpaidMembers,
      paidMembers,
    };
  }

  /**
   * Fetches recent verified ledger transactions
   */
  async getRecentTransactions(groupId: string, limit = 5) {
    const { data } = await this.supabase
      .from("ledger_entries")
      .select("id, entry_type, amount, running_balance, created_at, group_members(profiles(display_name))")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data || []).map((row: any) => ({
      id: row.id,
      type: row.entry_type,
      amount: Number(row.amount),
      runningBalance: Number(row.running_balance),
      member: row.group_members?.profiles?.display_name || "สมาชิก",
      createdAt: row.created_at,
    }));
  }
}

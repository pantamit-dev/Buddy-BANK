import { createAdminClient } from "@/integrations/supabase/server";
import { LedgerService } from "@/modules/ledger/service";
import type { WithdrawalStatus, VoteChoice } from "@/shared/types/database.types";

export interface CreateWithdrawalParams {
  groupId: string;
  requestedByMemberId: string;
  amount: number;
  purpose: string;
  receiptStoragePath?: string | null;
  votingDurationHours?: number;
}

export interface VoteWithdrawalParams {
  withdrawalId: string;
  voterMemberId: string;
  choice: VoteChoice;
}

export interface QuorumResolutionResult {
  status: WithdrawalStatus;
  quorumReached: boolean;
  approveVotes: number;
  rejectVotes: number;
  totalMembers: number;
  requiredApprovals: number;
  transactionId?: string;
}

export class WithdrawalService {
  private ledgerService: LedgerService;

  constructor(private supabase = createAdminClient()) {
    this.ledgerService = new LedgerService(this.supabase);
  }

  /**
   * Submits a withdrawal request with optional invoice/receipt proof
   */
  async createWithdrawalRequest(params: CreateWithdrawalParams) {
    const { groupId, requestedByMemberId, amount, purpose, receiptStoragePath } = params;

    if (!amount || amount <= 0) {
      throw new Error("Withdrawal amount must be strictly greater than 0");
    }

    if (!purpose || purpose.trim().length === 0) {
      throw new Error("Withdrawal purpose is mandatory");
    }

    // 1. Check available group balance
    const balance = await this.ledgerService.getGroupBalance(groupId);
    if (balance.currentBalance < amount) {
      throw new Error(
        `INSUFFICIENT_POOL_BALANCE: Current pool balance is ฿${balance.currentBalance.toLocaleString()} but requested ฿${amount.toLocaleString()}`
      );
    }

    // 2. Fetch group settings for duration
    const { data: settings } = await this.supabase
      .from("group_settings")
      .select("voting_duration_hours")
      .eq("group_id", groupId)
      .maybeSingle();

    const durationHours = params.votingDurationHours || settings?.voting_duration_hours || 48;
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

    // 3. Insert withdrawal in 'pending_vote' status
    const { data: withdrawal, error } = await this.supabase
      .from("withdrawals")
      .insert({
        group_id: groupId,
        requested_by: requestedByMemberId,
        amount,
        purpose: purpose.trim(),
        receipt_storage_path: receiptStoragePath || null,
        status: "pending_vote",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return withdrawal;
  }

  /**
   * Casts a member vote (Approve / Reject) and triggers quorum evaluation
   */
  async voteWithdrawal(params: VoteWithdrawalParams): Promise<QuorumResolutionResult> {
    const { withdrawalId, voterMemberId, choice } = params;

    // 1. Fetch withdrawal
    const { data: withdrawal, error: fetchErr } = await this.supabase
      .from("withdrawals")
      .select("*, groups(id, line_group_id)")
      .eq("id", withdrawalId)
      .maybeSingle();

    if (fetchErr || !withdrawal) {
      throw new Error("Withdrawal request not found");
    }

    if (withdrawal.status !== "pending_vote") {
      throw new Error(`Cannot vote on withdrawal with status '${withdrawal.status}'`);
    }

    // Check expiration
    if (new Date(withdrawal.expires_at).getTime() <= Date.now()) {
      await this.supabase
        .from("withdrawals")
        .update({ status: "rejected" })
        .eq("id", withdrawalId);
      throw new Error("VOTING_PERIOD_EXPIRED: The voting duration for this request has elapsed");
    }

    // 2. Check voter is active member of this group
    const { data: voter } = await this.supabase
      .from("group_members")
      .select("id, status")
      .eq("id", voterMemberId)
      .eq("group_id", withdrawal.group_id)
      .maybeSingle();

    if (!voter || voter.status !== "active") {
      throw new Error("UNAUTHORIZED_VOTER: Only active members of the group can vote");
    }

    // 3. Idempotent upsert vote
    const { error: voteErr } = await this.supabase
      .from("withdrawal_votes")
      .upsert(
        {
          withdrawal_id: withdrawalId,
          member_id: voterMemberId,
          vote_choice: choice,
          voted_at: new Date().toISOString(),
        },
        { onConflict: "withdrawal_id,member_id" }
      );

    if (voteErr) {
      throw voteErr;
    }

    // 4. Resolve quorum
    return await this.checkAndResolveQuorum(withdrawalId);
  }

  /**
   * Evaluates voting quorum against group_settings.voting_quorum_percent.
   * If quorum is reached, atomically commits debit transaction and ledger entry.
   */
  async checkAndResolveQuorum(withdrawalId: string): Promise<QuorumResolutionResult> {
    // 1. Fetch withdrawal
    const { data: withdrawal, error: fetchErr } = await this.supabase
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (fetchErr || !withdrawal) {
      throw new Error("Withdrawal not found");
    }

    const groupId = withdrawal.group_id;

    // 2. Check if voting period expired
    if (new Date(withdrawal.expires_at).getTime() <= Date.now()) {
      if (withdrawal.status === "pending_vote") {
        await this.supabase
          .from("withdrawals")
          .update({ status: "rejected" })
          .eq("id", withdrawalId)
          .eq("status", "pending_vote");
      }
      return {
        status: "rejected",
        quorumReached: false,
        approveVotes: 0,
        rejectVotes: 0,
        totalMembers: 1,
        requiredApprovals: 1,
      };
    }

    // 3. Fetch group settings
    const { data: settings } = await this.supabase
      .from("group_settings")
      .select("voting_quorum_percent")
      .eq("group_id", groupId)
      .maybeSingle();

    const quorumPercent = Number(settings?.voting_quorum_percent || 50.0);

    // 3. Count active members in the group
    const { data: members } = await this.supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("status", "active");

    const totalMembers = members?.length || 1;

    // 4. Count current votes
    const { data: votes } = await this.supabase
      .from("withdrawal_votes")
      .select("vote_choice")
      .eq("withdrawal_id", withdrawalId);

    const approveVotes = (votes || []).filter((v) => v.vote_choice === "approve").length;
    const rejectVotes = (votes || []).filter((v) => v.vote_choice === "reject").length;

    // Required approvals = ceiling(totalMembers * quorumPercent / 100)
    const requiredApprovals = Math.max(1, Math.ceil((totalMembers * quorumPercent) / 100));

    // A. Quorum Reached -> Approve & Commit Debit Ledger Entry
    if (approveVotes >= requiredApprovals && withdrawal.status === "pending_vote") {
      // Atomic status update
      const { data: updatedWithdrawal, error: updateErr } = await this.supabase
        .from("withdrawals")
        .update({ status: "approved" })
        .eq("id", withdrawalId)
        .eq("status", "pending_vote")
        .select()
        .maybeSingle();

      if (updateErr || !updatedWithdrawal) {
        // Concurrently processed already
        return {
          status: "approved",
          quorumReached: true,
          approveVotes,
          rejectVotes,
          totalMembers,
          requiredApprovals,
        };
      }

      // Calculate new running balance and guard against pool overdraft
      const { data: lastLedger } = await this.supabase
        .from("ledger_entries")
        .select("running_balance")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevBalance = Number(lastLedger?.running_balance || 0);
      const withdrawalAmount = Number(withdrawal.amount);

      if (prevBalance < withdrawalAmount) {
        // Insufficient funds at resolution time -> Reject withdrawal
        await this.supabase
          .from("withdrawals")
          .update({ status: "rejected" })
          .eq("id", withdrawalId);

        return {
          status: "rejected",
          quorumReached: false,
          approveVotes,
          rejectVotes,
          totalMembers,
          requiredApprovals,
        };
      }

      const newBalance = prevBalance - withdrawalAmount;

      // Record transaction
      const { data: transaction, error: txErr } = await this.supabase
        .from("transactions")
        .insert({
          group_id: groupId,
          withdrawal_id: withdrawalId,
          deposit_id: null,
          amount: withdrawalAmount,
          transaction_type: "withdrawal",
        })
        .select()
        .single();

      if (txErr) {
        throw txErr;
      }

      // Append immutable debit entry
      await this.supabase.from("ledger_entries").insert({
        transaction_id: transaction.id,
        group_id: groupId,
        member_id: withdrawal.requested_by,
        entry_type: "debit",
        amount: withdrawalAmount,
        running_balance: newBalance,
      });

      return {
        status: "approved",
        quorumReached: true,
        approveVotes,
        rejectVotes,
        totalMembers,
        requiredApprovals,
        transactionId: transaction.id,
      };
    }

    // B. Impossible to reach quorum (Too many rejections)
    const remainingPossibleApprovals = totalMembers - rejectVotes;
    if (remainingPossibleApprovals < requiredApprovals && withdrawal.status === "pending_vote") {
      await this.supabase
        .from("withdrawals")
        .update({ status: "rejected" })
        .eq("id", withdrawalId)
        .eq("status", "pending_vote");

      return {
        status: "rejected",
        quorumReached: false,
        approveVotes,
        rejectVotes,
        totalMembers,
        requiredApprovals,
      };
    }

    // C. Still in progress
    return {
      status: withdrawal.status as WithdrawalStatus,
      quorumReached: false,
      approveVotes,
      rejectVotes,
      totalMembers,
      requiredApprovals,
    };
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { WithdrawalService } from "@/modules/withdrawals/service";
import { MembershipService } from "@/modules/membership/service";
import { LedgerService } from "@/modules/ledger/service";
import { defaultLineClient } from "@/modules/line-webhook/line-client";
import {
  createWithdrawalVotingFlexMessage,
  createWithdrawalResultFlexMessage,
} from "@/modules/withdrawals/flex-templates";
import {
  WithdrawalQuerySchema,
  CreateWithdrawalSchema,
  VoteWithdrawalActionSchema,
  CancelWithdrawalActionSchema,
} from "@/shared/schemas/withdrawal.schema";

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);

    const parsedQuery = WithdrawalQuerySchema.safeParse({
      groupId: searchParams.get("groupId") || undefined,
      status: searchParams.get("status") || undefined,
      limit: searchParams.get("limit") || 30,
      offset: searchParams.get("offset") || 0,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsedQuery.error.issues },
        { status: 400 }
      );
    }

    const { groupId, status, limit, offset } = parsedQuery.data;

    // 1. Fetch group quorum config, active members count, and balance in parallel
    const ledgerService = new LedgerService(supabase);
    const [settingsRes, membersCountRes, balance] = await Promise.all([
      supabase
        .from("group_settings")
        .select("voting_quorum_percent, voting_duration_hours")
        .eq("group_id", groupId)
        .maybeSingle(),
      supabase
        .from("group_members")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId)
        .eq("status", "active"),
      ledgerService.getGroupBalance(groupId),
    ]);

    const quorumPercent = Number(settingsRes.data?.voting_quorum_percent || 50);
    const durationHours = Number(settingsRes.data?.voting_duration_hours || 48);
    const totalActiveMembers = membersCountRes.count || 1;
    const requiredApprovals = Math.max(
      1,
      Math.ceil((totalActiveMembers * quorumPercent) / 100)
    );

    // 2. Expire any stale pending_vote withdrawals before returning
    const nowIso = new Date().toISOString();
    await supabase
      .from("withdrawals")
      .update({ status: "rejected" })
      .eq("group_id", groupId)
      .eq("status", "pending_vote")
      .lte("expires_at", nowIso);

    // 3. Query withdrawals with requester profile
    let query = supabase
      .from("withdrawals")
      .select(
        `
        id,
        group_id,
        requested_by,
        amount,
        purpose,
        receipt_storage_path,
        status,
        expires_at,
        created_at,
        group_members!requested_by(
          id,
          role,
          profiles(
            id,
            line_user_id,
            display_name,
            picture_url
          )
        )
      `
      )
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: withdrawals, error } = await query;
    if (error) throw error;

    const withdrawalIds = (withdrawals || []).map((w) => w.id);
    let votesByWithdrawal: Record<string, any[]> = {};

    if (withdrawalIds.length > 0) {
      const { data: votes } = await supabase
        .from("withdrawal_votes")
        .select(
          `
          id,
          withdrawal_id,
          member_id,
          vote_choice,
          voted_at,
          group_members(
            id,
            profiles(
              id,
              line_user_id,
              display_name,
              picture_url
            )
          )
        `
        )
        .in("withdrawal_id", withdrawalIds)
        .order("voted_at", { ascending: true });

      for (const v of votes || []) {
        if (!votesByWithdrawal[v.withdrawal_id]) {
          votesByWithdrawal[v.withdrawal_id] = [];
        }
        votesByWithdrawal[v.withdrawal_id].push(v);
      }
    }

    const enriched = (withdrawals || []).map((w) => {
      const wVotes = votesByWithdrawal[w.id] || [];
      const approveVotes = wVotes.filter((v) => v.vote_choice === "approve").length;
      const rejectVotes = wVotes.filter((v) => v.vote_choice === "reject").length;

      return {
        ...w,
        votes: wVotes,
        approveVotes,
        rejectVotes,
        requiredApprovals,
        totalMembers: totalActiveMembers,
      };
    });

    return NextResponse.json({
      withdrawals: enriched,
      quorumConfig: {
        quorumPercent,
        durationHours,
        totalActiveMembers,
        requiredApprovals,
      },
      currentBalance: balance.currentBalance,
    });
  } catch (error) {
    console.error("[WithdrawalsRoute] GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateWithdrawalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      groupId,
      requesterLineUserId,
      amount,
      purpose,
      receiptStoragePath,
      votingDurationHours,
    } = parsed.data;

    const supabase = createAdminClient();
    const membershipService = new MembershipService(supabase);
    const withdrawalService = new WithdrawalService(supabase);

    // 1. Verify requester is an active member of this group
    const requester = await membershipService.getMemberByLineUserId(
      groupId,
      requesterLineUserId
    );

    if (!requester || requester.status !== "active") {
      return NextResponse.json(
        { error: "เฉพาะสมาชิกที่ได้รับการอนุมัติในกลุ่มเท่านั้นที่สามารถเสนอเบิกเงินได้" },
        { status: 403 }
      );
    }

    // 2. Create withdrawal request (also validates pool balance)
    const withdrawal = await withdrawalService.createWithdrawalRequest({
      groupId,
      requestedByMemberId: requester.memberId,
      amount,
      purpose,
      receiptStoragePath: receiptStoragePath || null,
      votingDurationHours,
    });

    // 3. Compute quorum requirement and optionally notify LINE Group
    const [groupRes, settingsRes, membersCountRes] = await Promise.all([
      supabase
        .from("groups")
        .select("line_group_id")
        .eq("id", groupId)
        .maybeSingle(),
      supabase
        .from("group_settings")
        .select("voting_quorum_percent")
        .eq("group_id", groupId)
        .maybeSingle(),
      supabase
        .from("group_members")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId)
        .eq("status", "active"),
    ]);

    const quorumPercent = Number(settingsRes.data?.voting_quorum_percent || 50);
    const totalMembers = membersCountRes.count || 1;
    const requiredApprovals = Math.max(
      1,
      Math.ceil((totalMembers * quorumPercent) / 100)
    );

    let lineNotified = false;
    const lineGroupId = groupRes.data?.line_group_id;
    if (
      lineGroupId &&
      process.env.LINE_CHANNEL_ACCESS_TOKEN &&
      process.env.LINE_CHANNEL_ACCESS_TOKEN !== "your_line_channel_access_token_here"
    ) {
      try {
        const votingFlex = createWithdrawalVotingFlexMessage({
          withdrawalId: withdrawal.id,
          amount: Number(withdrawal.amount),
          purpose: withdrawal.purpose,
          requesterName: requester.displayName || "สมาชิก",
          approveVotes: 0,
          rejectVotes: 0,
          requiredApprovals,
          expiresAt: withdrawal.expires_at,
        });
        await defaultLineClient.pushMessage(lineGroupId, [votingFlex]);
        lineNotified = true;
      } catch (lineErr) {
        console.warn("[WithdrawalsRoute] Non-fatal LINE push error:", lineErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        withdrawal,
        requiredApprovals,
        totalMembers,
        lineNotified,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[WithdrawalsRoute] POST error:", error);
    const msg = error?.message || "Internal Server Error";
    const status = msg.includes("INSUFFICIENT_POOL_BALANCE") ? 400 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createAdminClient();
    const membershipService = new MembershipService(supabase);
    const withdrawalService = new WithdrawalService(supabase);

    // A. Cancel withdrawal request
    if (body?.action === "cancel") {
      const parsedCancel = CancelWithdrawalActionSchema.safeParse(body);
      if (!parsedCancel.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsedCancel.error.issues },
          { status: 400 }
        );
      }

      const { withdrawalId, actorLineUserId } = parsedCancel.data;
      const { data: withdrawal } = await supabase
        .from("withdrawals")
        .select("id, group_id, requested_by, status")
        .eq("id", withdrawalId)
        .maybeSingle();

      if (!withdrawal) {
        return NextResponse.json({ error: "ไม่พบคำขอเบิกเงิน" }, { status: 404 });
      }

      if (withdrawal.status !== "pending_vote") {
        return NextResponse.json(
          { error: "สามารถยกเลิกได้เฉพาะรายการที่อยู่ระหว่างรอผลโหวตเท่านั้น" },
          { status: 409 }
        );
      }

      const actor = await membershipService.getMemberByLineUserId(
        withdrawal.group_id,
        actorLineUserId
      );

      if (
        !actor ||
        actor.status !== "active" ||
        (actor.memberId !== withdrawal.requested_by &&
          actor.role !== "owner" &&
          actor.role !== "treasurer")
      ) {
        return NextResponse.json(
          { error: "ไม่มีสิทธิ์ยกเลิกคำขอเบิกเงินนี้" },
          { status: 403 }
        );
      }

      const { error: cancelErr } = await supabase
        .from("withdrawals")
        .update({ status: "cancelled" })
        .eq("id", withdrawalId)
        .eq("status", "pending_vote");

      if (cancelErr) throw cancelErr;

      return NextResponse.json({ success: true, status: "cancelled" });
    }

    // B. Cast or update vote on withdrawal request
    const parsedVote = VoteWithdrawalActionSchema.safeParse(body);
    if (!parsedVote.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsedVote.error.issues },
        { status: 400 }
      );
    }

    const { withdrawalId, voterLineUserId, choice } = parsedVote.data;

    const { data: withdrawal } = await supabase
      .from("withdrawals")
      .select("id, group_id, amount, purpose, groups(line_group_id)")
      .eq("id", withdrawalId)
      .maybeSingle();

    if (!withdrawal) {
      return NextResponse.json({ error: "ไม่พบคำขอเบิกเงิน" }, { status: 404 });
    }

    const voter = await membershipService.getMemberByLineUserId(
      withdrawal.group_id,
      voterLineUserId
    );

    if (!voter || voter.status !== "active") {
      return NextResponse.json(
        { error: "เฉพาะสมาชิกที่ได้รับการอนุมัติในกลุ่มเท่านั้นที่มีสิทธิ์โหวต" },
        { status: 403 }
      );
    }

    const voteResult = await withdrawalService.voteWithdrawal({
      withdrawalId,
      voterMemberId: voter.memberId,
      choice,
    });

    // Notify LINE group if quorum resolved (approved or rejected)
    const lineGroupId = (withdrawal.groups as any)?.line_group_id;
    if (
      (voteResult.status === "approved" || voteResult.status === "rejected") &&
      lineGroupId &&
      process.env.LINE_CHANNEL_ACCESS_TOKEN &&
      process.env.LINE_CHANNEL_ACCESS_TOKEN !== "your_line_channel_access_token_here"
    ) {
      try {
        let newBalance: number | undefined;
        if (voteResult.status === "approved") {
          const ledgerService = new LedgerService(supabase);
          const bal = await ledgerService.getGroupBalance(withdrawal.group_id);
          newBalance = bal.currentBalance;
        }
        const resultFlex = createWithdrawalResultFlexMessage({
          amount: Number(withdrawal.amount),
          purpose: withdrawal.purpose,
          status: voteResult.status,
          approveVotes: voteResult.approveVotes,
          rejectVotes: voteResult.rejectVotes,
          newBalance,
        });
        await defaultLineClient.pushMessage(lineGroupId, [resultFlex]);
      } catch (lineErr) {
        console.warn("[WithdrawalsRoute] Non-fatal LINE push result error:", lineErr);
      }
    }

    return NextResponse.json({ success: true, voteResult });
  } catch (error: any) {
    console.error("[WithdrawalsRoute] PATCH error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 400 }
    );
  }
}

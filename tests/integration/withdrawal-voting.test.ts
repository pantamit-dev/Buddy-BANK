import { describe, it, expect, vi, beforeEach } from "vitest";
import { LineEventRouter } from "@/modules/line-webhook/event-router";
import { WithdrawalService } from "@/modules/withdrawals/service";

describe("Withdrawal Democratic Voting Integration Tests", () => {
  let mockDatabase: {
    groups: any[];
    group_members: any[];
    profiles: any[];
    withdrawals: any[];
    withdrawal_votes: any[];
    transactions: any[];
    ledger_entries: any[];
    webhook_events: any[];
  };

  let mockSupabase: any;
  let mockLineClient: any;
  let eventRouter: LineEventRouter;
  let withdrawalService: WithdrawalService;

  beforeEach(() => {
    mockDatabase = {
      groups: [
        {
          id: "g-japan-100",
          line_group_id: "C_GROUP_JAPAN",
          name: "Japan Trip",
          target_amount: 30000,
        },
      ],
      profiles: [
        { id: "p-owner", line_user_id: "U_OWNER_1", display_name: "Alice Owner" },
        { id: "p-treasurer", line_user_id: "U_TREAS_2", display_name: "Bob Treasurer" },
        { id: "p-member", line_user_id: "U_MEM_3", display_name: "Charlie Member" },
      ],
      group_members: [
        {
          id: "gm-owner",
          group_id: "g-japan-100",
          user_id: "p-owner",
          role: "owner",
          status: "active",
          profiles: { id: "p-owner", line_user_id: "U_OWNER_1", display_name: "Alice Owner" },
        },
        {
          id: "gm-treasurer",
          group_id: "g-japan-100",
          user_id: "p-treasurer",
          role: "treasurer",
          status: "active",
          profiles: { id: "p-treasurer", line_user_id: "U_TREAS_2", display_name: "Bob Treasurer" },
        },
        {
          id: "gm-member",
          group_id: "g-japan-100",
          user_id: "p-member",
          role: "member",
          status: "active",
          profiles: { id: "p-member", line_user_id: "U_MEM_3", display_name: "Charlie Member" },
        },
      ],
      withdrawals: [],
      withdrawal_votes: [],
      transactions: [],
      ledger_entries: [
        {
          id: "led-init",
          group_id: "g-japan-100",
          member_id: "gm-owner",
          entry_type: "credit",
          amount: 10000,
          running_balance: 10000,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
      webhook_events: [],
    };

    mockSupabase = {
      from: (table: string) => ({
        insert: (payload: any) => ({
          select: () => ({
            single: async () => {
              const record = {
                id: `rec-${(mockDatabase as any)[table]?.length + 1}`,
                ...payload,
                created_at: new Date().toISOString(),
              };
              (mockDatabase as any)[table]?.push(record);
              return { data: record, error: null };
            },
          }),
          then: (resolve: any) => {
            const record = {
              id: `rec-${(mockDatabase as any)[table]?.length + 1}`,
              ...payload,
              created_at: new Date().toISOString(),
            };
            (mockDatabase as any)[table]?.push(record);
            resolve({ data: record, error: null });
          },
        }),
        upsert: async (payload: any) => {
          const matchIndex = mockDatabase.withdrawal_votes.findIndex(
            (v) => v.withdrawal_id === payload.withdrawal_id && v.member_id === payload.member_id
          );
          if (matchIndex >= 0) {
            mockDatabase.withdrawal_votes[matchIndex] = { ...mockDatabase.withdrawal_votes[matchIndex], ...payload };
          } else {
            mockDatabase.withdrawal_votes.push({
              id: `wv-${mockDatabase.withdrawal_votes.length + 1}`,
              ...payload,
            });
          }
          return { error: null };
        },
        select: (cols: string) => ({
          eq: (f1: string, v1: any) => {
            const chain: any = {
              eq: (f2: string, v2: any) => {
                const subchain: any = {
                  single: async () => {
                    const match = (mockDatabase as any)[table]?.find(
                      (r: any) => r[f1] === v1 && r[f2] === v2
                    );
                    return { data: match || null, error: match ? null : new Error("Not found") };
                  },
                  maybeSingle: async () => {
                    const match = (mockDatabase as any)[table]?.find(
                      (r: any) => r[f1] === v1 && r[f2] === v2
                    );
                    return { data: match || null, error: null };
                  },
                };
                subchain.then = (resolve: any) => {
                  const list = (mockDatabase as any)[table]?.filter(
                    (r: any) => r[f1] === v1 && r[f2] === v2
                  );
                  resolve({ data: list || [], error: null });
                };
                return subchain;
              },
              single: async () => {
                const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
                return { data: match || null, error: match ? null : new Error("Not found") };
              },
              maybeSingle: async () => {
                if (table === "profiles") {
                  const match = mockDatabase.profiles.find((p) => p.line_user_id === v1);
                  return { data: match || null, error: null };
                }
                const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
                return { data: match || null, error: null };
              },
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => {
                    const list = (mockDatabase as any)[table]?.filter((r: any) => r[f1] === v1);
                    return { data: list?.[list.length - 1] || null, error: null };
                  },
                }),
              }),
            };
            chain.then = (resolve: any) => {
              const list = (mockDatabase as any)[table]?.filter((r: any) => r[f1] === v1);
              resolve({ data: list || [], error: null });
            };
            return chain;
          },
        }),
        update: (payload: any) => ({
          eq: (f1: string, v1: any) => {
            const chain: any = {
              eq: (f2: string, v2: any) => ({
                select: () => ({
                  maybeSingle: async () => {
                    const match = (mockDatabase as any)[table]?.find(
                      (r: any) => r[f1] === v1 && r[f2] === v2
                    );
                    if (!match) return { data: null, error: null };
                    Object.assign(match, payload);
                    return { data: match, error: null };
                  },
                }),
              }),
            };
            chain.then = (resolve: any) => {
              const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
              if (match) Object.assign(match, payload);
              resolve({ data: match, error: null });
            };
            return chain;
          },
        }),
      }),
    };

    mockLineClient = {
      pushMessage: vi.fn().mockResolvedValue({}),
      replyMessage: vi.fn().mockResolvedValue({}),
      showLoadingAnimation: vi.fn().mockResolvedValue(true),
    };

    withdrawalService = new WithdrawalService(mockSupabase);
    eventRouter = new LineEventRouter(mockLineClient);
    (eventRouter as any).supabase = mockSupabase;
    (eventRouter as any).membershipService = {
      getMemberByLineUserId: async (groupId: string, lineUserId: string) => {
        const member = mockDatabase.group_members.find(
          (m) => m.group_id === groupId && m.profiles.line_user_id === lineUserId
        );
        if (!member) return null;
        return {
          memberId: member.id,
          groupId: member.group_id,
          userId: member.user_id,
          role: member.role,
          status: member.status,
          displayName: member.profiles.display_name,
        };
      },
    };
  });

  it("orchestrates withdrawal request, in-chat group postback voting, quorum resolution, and atomic debit commit", async () => {
    // 1. Treasurer requests 3,000 THB withdrawal for Airbnb booking
    const withdrawal = await withdrawalService.createWithdrawalRequest({
      groupId: "g-japan-100",
      requestedByMemberId: "gm-treasurer",
      amount: 3000,
      purpose: "จองที่พัก Airbnb โตเกียว",
    });

    expect(withdrawal.status).toBe("pending_vote");
    expect(mockDatabase.withdrawals.length).toBe(1);

    // 2. Owner votes APPROVE via LINE group postback
    const ownerVoteEvent: any = {
      type: "postback",
      replyToken: "reply_tok_owner",
      source: {
        type: "group",
        groupId: "C_GROUP_JAPAN",
        userId: "U_OWNER_1",
      },
      postback: {
        data: `action=vote_withdrawal&withdrawal_id=${withdrawal.id}&choice=approve`,
      },
    };

    const ownerResult = await eventRouter.handleSingleEvent(ownerVoteEvent);
    expect(ownerResult.success).toBe(true);
    expect(ownerResult.voteResult.quorumReached).toBe(false);
    expect(ownerResult.voteResult.approveVotes).toBe(1);

    // 3. Member votes APPROVE via LINE group postback (3 total members -> ceil(3 * 0.5) = 2 -> QUORUM REACHED!)
    const memberVoteEvent: any = {
      type: "postback",
      replyToken: "reply_tok_member",
      source: {
        type: "group",
        groupId: "C_GROUP_JAPAN",
        userId: "U_MEM_3",
      },
      postback: {
        data: `action=vote_withdrawal&withdrawal_id=${withdrawal.id}&choice=approve`,
      },
    };

    const memberResult = await eventRouter.handleSingleEvent(memberVoteEvent);
    expect(memberResult.success).toBe(true);
    expect(memberResult.voteResult.quorumReached).toBe(true);
    expect(memberResult.voteResult.status).toBe("approved");

    // 4. Verify transaction created
    const tx = mockDatabase.transactions.find((t) => t.withdrawal_id === withdrawal.id);
    expect(tx).toBeDefined();
    expect(tx.transaction_type).toBe("withdrawal");
    expect(tx.amount).toBe(3000);

    // 5. Verify debit ledger entry reduced running balance from 10,000 to 7,000
    const debitEntry = mockDatabase.ledger_entries.find(
      (l) => l.entry_type === "debit" && l.transaction_id === tx.id
    );
    expect(debitEntry).toBeDefined();
    expect(debitEntry.amount).toBe(3000);
    expect(debitEntry.running_balance).toBe(7000);

    // 6. Verify flex result reply was triggered
    expect(mockLineClient.replyMessage).toHaveBeenCalled();
  });
});

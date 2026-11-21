import { describe, it, expect, vi, beforeEach } from "vitest";
import { WithdrawalService } from "@/modules/withdrawals/service";

describe("Withdrawal Request & Democratic Voting Quorum Unit Tests", () => {
  let mockDatabase: {
    withdrawals: any[];
    withdrawal_votes: any[];
    group_settings: any[];
    group_members: any[];
    groups: any[];
    transactions: any[];
    ledger_entries: any[];
  };

  let mockSupabase: any;
  let withdrawalService: WithdrawalService;

  beforeEach(() => {
    mockDatabase = {
      groups: [
        {
          id: "g-test-pool",
          name: "Trip Fund",
          target_amount: 10000,
        },
      ],
      group_settings: [
        {
          id: "gs-1",
          group_id: "g-test-pool",
          voting_quorum_percent: 50.0, // 50% quorum
          voting_duration_hours: 24,
        },
      ],
      group_members: [
        { id: "m-1", group_id: "g-test-pool", user_id: "u-1", status: "active", role: "owner" },
        { id: "m-2", group_id: "g-test-pool", user_id: "u-2", status: "active", role: "treasurer" },
        { id: "m-3", group_id: "g-test-pool", user_id: "u-3", status: "active", role: "member" },
        { id: "m-4", group_id: "g-test-pool", user_id: "u-4", status: "active", role: "member" },
      ], // 4 active members -> 50% quorum requires ceil(4 * 0.5) = 2 approvals
      withdrawals: [],
      withdrawal_votes: [],
      transactions: [],
      ledger_entries: [
        {
          id: "led-1",
          group_id: "g-test-pool",
          member_id: "m-1",
          entry_type: "credit",
          amount: 5000,
          running_balance: 5000,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
    };

    mockSupabase = {
      from: (table: string) => ({
        insert: (payload: any) => ({
          select: () => ({
            single: async () => {
              const record = {
                id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                ...payload,
                created_at: new Date().toISOString(),
              };
              (mockDatabase as any)[table]?.push(record);
              return { data: record, error: null };
            },
          }),
          then: (resolve: any) => {
            const record = {
              id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              ...payload,
              created_at: new Date().toISOString(),
            };
            (mockDatabase as any)[table]?.push(record);
            resolve({ data: record, error: null });
          },
        }),
        upsert: async (payload: any, opts: any) => {
          const matchIndex = mockDatabase.withdrawal_votes.findIndex(
            (v) => v.withdrawal_id === payload.withdrawal_id && v.member_id === payload.member_id
          );
          if (matchIndex >= 0) {
            mockDatabase.withdrawal_votes[matchIndex] = { ...mockDatabase.withdrawal_votes[matchIndex], ...payload };
          } else {
            mockDatabase.withdrawal_votes.push({ id: `vote-${mockDatabase.withdrawal_votes.length + 1}`, ...payload });
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
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => {
                    const list = (mockDatabase as any)[table]?.filter((r: any) => r[f1] === v1);
                    return { data: list?.[list.length - 1] || null, error: null };
                  },
                }),
              }),
              single: async () => {
                const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
                return { data: match || null, error: match ? null : new Error("Not found") };
              },
              maybeSingle: async () => {
                const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
                return { data: match || null, error: null };
              },
            };
            // Support direct query array resolution: e.g. await from(...).select(...).eq(...)
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

    withdrawalService = new WithdrawalService(mockSupabase);
  });

  describe("Withdrawal Request Creation", () => {
    it("creates a withdrawal request when funds are sufficient", async () => {
      const withdrawal = await withdrawalService.createWithdrawalRequest({
        groupId: "g-test-pool",
        requestedByMemberId: "m-2",
        amount: 1500,
        purpose: "จองรถตู้ไปทริป",
      });

      expect(withdrawal).toBeDefined();
      expect(withdrawal.amount).toBe(1500);
      expect(withdrawal.status).toBe("pending_vote");
      expect(withdrawal.purpose).toBe("จองรถตู้ไปทริป");
    });

    it("rejects withdrawal request exceeding current pool balance", async () => {
      // Pool balance is 5,000, attempt requesting 8,000
      await expect(
        withdrawalService.createWithdrawalRequest({
          groupId: "g-test-pool",
          requestedByMemberId: "m-2",
          amount: 8000,
          purpose: "เกินงบ",
        })
      ).rejects.toThrow(/INSUFFICIENT_POOL_BALANCE/);
    });

    it("rejects non-positive withdrawal amounts", async () => {
      await expect(
        withdrawalService.createWithdrawalRequest({
          groupId: "g-test-pool",
          requestedByMemberId: "m-2",
          amount: 0,
          purpose: "ฟรี",
        })
      ).rejects.toThrow(/greater than 0/);
    });
  });

  describe("Voting & Quorum Resolution", () => {
    it("accumulates votes and reaches quorum, automatically committing a debit ledger entry", async () => {
      // 1. Create request for 2,000 THB
      const withdrawal = await withdrawalService.createWithdrawalRequest({
        groupId: "g-test-pool",
        requestedByMemberId: "m-2",
        amount: 2000,
        purpose: "ซื้อตั๋วเครื่องบิน",
      });

      // 2. Member 1 votes approve (1 / 2 required)
      const res1 = await withdrawalService.voteWithdrawal({
        withdrawalId: withdrawal.id,
        voterMemberId: "m-1",
        choice: "approve",
      });

      expect(res1.quorumReached).toBe(false);
      expect(res1.status).toBe("pending_vote");
      expect(res1.approveVotes).toBe(1);
      expect(res1.requiredApprovals).toBe(2);

      // 3. Member 3 votes approve (2 / 2 required -> QUORUM REACHED!)
      const res2 = await withdrawalService.voteWithdrawal({
        withdrawalId: withdrawal.id,
        voterMemberId: "m-3",
        choice: "approve",
      });

      expect(res2.quorumReached).toBe(true);
      expect(res2.status).toBe("approved");
      expect(res2.approveVotes).toBe(2);

      // 4. Verify transaction was created
      const tx = mockDatabase.transactions.find((t) => t.withdrawal_id === withdrawal.id);
      expect(tx).toBeDefined();
      expect(tx.amount).toBe(2000);
      expect(tx.transaction_type).toBe("withdrawal");

      // 5. Verify debit ledger entry was created with updated running balance
      const debitEntry = mockDatabase.ledger_entries.find(
        (l) => l.entry_type === "debit" && l.transaction_id === tx.id
      );
      expect(debitEntry).toBeDefined();
      expect(debitEntry.amount).toBe(2000);
      expect(debitEntry.running_balance).toBe(3000); // 5000 - 2000 = 3000
    });

    it("rejects withdrawal when enough members vote against it", async () => {
      const withdrawal = await withdrawalService.createWithdrawalRequest({
        groupId: "g-test-pool",
        requestedByMemberId: "m-2",
        amount: 1000,
        purpose: "ซื้อของที่ไม่จำเป็น",
      });

      // 4 members, quorum needs 2 approves.
      // If 3 members reject, remaining possible approvals is 4 - 3 = 1 < 2 -> Impossible to reach quorum!
      await withdrawalService.voteWithdrawal({
        withdrawalId: withdrawal.id,
        voterMemberId: "m-1",
        choice: "reject",
      });
      await withdrawalService.voteWithdrawal({
        withdrawalId: withdrawal.id,
        voterMemberId: "m-3",
        choice: "reject",
      });
      const finalRes = await withdrawalService.voteWithdrawal({
        withdrawalId: withdrawal.id,
        voterMemberId: "m-4",
        choice: "reject",
      });

      expect(finalRes.quorumReached).toBe(false);
      expect(finalRes.status).toBe("rejected");
      expect(finalRes.rejectVotes).toBe(3);
    });

    it("rejects voting from an unauthorized or inactive member", async () => {
      const withdrawal = await withdrawalService.createWithdrawalRequest({
        groupId: "g-test-pool",
        requestedByMemberId: "m-2",
        amount: 500,
        purpose: "ค่าขนม",
      });

      // Attempt vote with unknown member ID
      await expect(
        withdrawalService.voteWithdrawal({
          withdrawalId: withdrawal.id,
          voterMemberId: "m-unknown-stranger",
          choice: "approve",
        })
      ).rejects.toThrow(/UNAUTHORIZED_VOTER/);
    });

    it("allows a member to change vote from reject to approve and resolves quorum correctly", async () => {
      const withdrawal = await withdrawalService.createWithdrawalRequest({
        groupId: "g-test-pool",
        requestedByMemberId: "m-2",
        amount: 1200,
        purpose: "ค่าอุปกรณ์",
      });

      // 1. Member 1 initially rejects
      const r1 = await withdrawalService.voteWithdrawal({
        withdrawalId: withdrawal.id,
        voterMemberId: "m-1",
        choice: "reject",
      });
      expect(r1.rejectVotes).toBe(1);
      expect(r1.approveVotes).toBe(0);
      expect(r1.status).toBe("pending_vote");

      // 2. Member 1 changes vote to approve
      const r2 = await withdrawalService.voteWithdrawal({
        withdrawalId: withdrawal.id,
        voterMemberId: "m-1",
        choice: "approve",
      });
      expect(r2.rejectVotes).toBe(0);
      expect(r2.approveVotes).toBe(1);
      expect(r2.status).toBe("pending_vote");

      // 3. Member 3 also votes approve -> Reaches quorum (2 approvals)
      const r3 = await withdrawalService.voteWithdrawal({
        withdrawalId: withdrawal.id,
        voterMemberId: "m-3",
        choice: "approve",
      });
      expect(r3.approveVotes).toBe(2);
      expect(r3.quorumReached).toBe(true);
      expect(r3.status).toBe("approved");
    });

    it("rejects voting on an expired withdrawal and marks it rejected", async () => {
      const withdrawal = await withdrawalService.createWithdrawalRequest({
        groupId: "g-test-pool",
        requestedByMemberId: "m-2",
        amount: 500,
        purpose: "คำขอหมดอายุ",
        votingDurationHours: 1,
      });

      // Force expiration in database
      const wInDb = mockDatabase.withdrawals.find((w) => w.id === withdrawal.id);
      wInDb.expires_at = new Date(Date.now() - 1000).toISOString();

      await expect(
        withdrawalService.voteWithdrawal({
          withdrawalId: withdrawal.id,
          voterMemberId: "m-1",
          choice: "approve",
        })
      ).rejects.toThrow(/VOTING_PERIOD_EXPIRED/);

      expect(wInDb.status).toBe("rejected");
    });

    it("guards against overdraft if pool balance is depleted before quorum commit", async () => {
      const withdrawal = await withdrawalService.createWithdrawalRequest({
        groupId: "g-test-pool",
        requestedByMemberId: "m-2",
        amount: 4000,
        purpose: "เบิกงบก้อนใหญ่",
      });

      // Deplete running balance in database between request and approval
      mockDatabase.ledger_entries.push({
        id: "led-drain",
        group_id: "g-test-pool",
        member_id: "m-1",
        entry_type: "debit",
        amount: 3500,
        running_balance: 1500, // Only 1,500 left now!
        created_at: new Date().toISOString(),
      });

      // Member 1 votes approve (1/2)
      await withdrawalService.voteWithdrawal({
        withdrawalId: withdrawal.id,
        voterMemberId: "m-1",
        choice: "approve",
      });

      // Member 3 votes approve (2/2 -> Quorum trigger, but balance is 1500 < 4000)
      const res = await withdrawalService.voteWithdrawal({
        withdrawalId: withdrawal.id,
        voterMemberId: "m-3",
        choice: "approve",
      });

      expect(res.status).toBe("rejected");
      expect(res.quorumReached).toBe(false);
      // Ensure no negative running balance was written
      const lastEntry = mockDatabase.ledger_entries[mockDatabase.ledger_entries.length - 1];
      expect(lastEntry.running_balance).toBe(1500);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DepositService } from "@/modules/deposits/service";
import { DepositStateMachine } from "@/modules/deposits/state-machine";

describe("Deposit Approval & Idempotency Integration Tests", () => {
  let mockDatabase: {
    deposits: any[];
    transactions: any[];
    ledger_entries: any[];
    group_members: any[];
    profiles: any[];
  };

  let mockSupabase: any;

  beforeEach(() => {
    mockDatabase = {
      profiles: [
        { id: "p-owner", line_user_id: "U_OWNER", display_name: "Alice Owner" },
        { id: "p-member", line_user_id: "U_MEMBER", display_name: "Bob Member" },
      ],
      group_members: [
        {
          id: "gm-owner",
          group_id: "g-1",
          user_id: "p-owner",
          role: "owner",
          status: "active",
          profiles: { id: "p-owner", line_user_id: "U_OWNER", display_name: "Alice Owner" },
        },
        {
          id: "gm-member",
          group_id: "g-1",
          user_id: "p-member",
          role: "member",
          status: "active",
          profiles: { id: "p-member", line_user_id: "U_MEMBER", display_name: "Bob Member" },
        },
      ],
      deposits: [
        {
          id: "dep-001",
          group_id: "g-1",
          member_id: "gm-member",
          status: "pending",
          detected_amount: 500.0,
          click_count: 0,
          bank_reference: "REF12345",
          group_members: { id: "gm-member", user_id: "p-member" },
        },
      ],
      transactions: [],
      ledger_entries: [],
    };

    mockSupabase = {
      from: (table: string) => ({
        select: (cols: string) => ({
          eq: (f1: string, v1: any) => ({
            eq: (f2: string, v2: any) => ({
              in: (f3: string, v3: any[]) => ({
                maybeSingle: async () => {
                  const match = (mockDatabase as any)[table]?.find(
                    (row: any) => row[f1] === v1 && row[f2] === v2 && v3.includes(row[f3])
                  );
                  return { data: match || null };
                },
              }),
              maybeSingle: async () => {
                const match = (mockDatabase as any)[table]?.find(
                  (row: any) => row[f1] === v1 && row[f2] === v2
                );
                return { data: match || null };
              },
            }),
            order: () => ({
              limit: () => ({
                maybeSingle: async () => {
                  const items = (mockDatabase as any)[table]?.filter(
                    (row: any) => row[f1] === v1
                  );
                  return { data: items?.[items.length - 1] || null };
                },
              }),
            }),
            maybeSingle: async () => {
              if (table === "profiles") {
                const match = mockDatabase.profiles.find((p) => p.line_user_id === v1);
                return { data: match || null };
              }
              const match = (mockDatabase as any)[table]?.find(
                (row: any) => row[f1] === v1
              );
              return { data: match || null };
            },
            single: async () => {
              const match = (mockDatabase as any)[table]?.find(
                (row: any) => row[f1] === v1
              );
              if (!match) throw new Error(`Not found in ${table}`);
              return { data: match };
            },
          }),
        }),
        update: (payload: any) => ({
          eq: (f1: string, v1: any) => ({
            eq: (f2: string, v2: any) => ({
              select: () => ({
                maybeSingle: async () => {
                  const target = (mockDatabase as any)[table]?.find(
                    (row: any) => row[f1] === v1 && row[f2] === v2
                  );
                  if (!target) return { data: null };
                  Object.assign(target, payload);
                  return { data: target };
                },
                single: async () => {
                  const target = (mockDatabase as any)[table]?.find(
                    (row: any) => row[f1] === v1 && row[f2] === v2
                  );
                  if (!target) throw new Error("Row not found for update");
                  Object.assign(target, payload);
                  return { data: target };
                },
              }),
            }),
            select: () => ({
              single: async () => {
                const target = (mockDatabase as any)[table]?.find(
                  (row: any) => row[f1] === v1
                );
                if (!target) throw new Error("Row not found for update");
                Object.assign(target, payload);
                return { data: target };
              },
            }),
          }),
        }),
        insert: (row: any) => {
          const inserted = { id: `gen-${Math.random()}`, ...row };
          (mockDatabase as any)[table]?.push(inserted);
          return {
            select: () => ({
              single: async () => ({ data: inserted, error: null }),
            }),
          };
        },
      }),
      storage: {
        from: () => ({
          upload: async () => ({ data: { path: "slips/test.jpg" }, error: null }),
          createSignedUrl: async () => ({ data: { signedUrl: "https://example.com/slip.jpg" } }),
        }),
      },
    };
  });

  it("locks deposit state atomically upon first approval", async () => {
    const stateMachine = new DepositStateMachine(mockSupabase);
    const lock1 = await stateMachine.lockForProcessing("dep-001");

    expect(lock1.success).toBe(true);
    expect(lock1.deposit.status).toBe("processing");
    expect(lock1.deposit.click_count).toBe(1);

    // Second concurrent lock must fail
    const lock2 = await stateMachine.lockForProcessing("dep-001");
    expect(lock2.success).toBe(false);
  });

  it("prevents duplicate ledger entries when multiple approval requests arrive concurrently", async () => {
    const depositService = new DepositService(mockSupabase);

    // 1st click from Owner
    const res1 = await depositService.reviewDeposit({
      depositId: "dep-001",
      action: "approve",
      reviewerLineUserId: "U_OWNER",
    });

    expect(res1.success).toBe(true);
    expect(res1.deposit?.status).toBe("verified");
    expect(mockDatabase.ledger_entries.length).toBe(1);
    expect(mockDatabase.transactions.length).toBe(1);

    // 2nd duplicate click on same deposit
    const res2 = await depositService.reviewDeposit({
      depositId: "dep-001",
      action: "approve",
      reviewerLineUserId: "U_OWNER",
    });

    // 2nd click must be rejected without creating another ledger entry
    expect(res2.success).toBe(false);
    expect(mockDatabase.ledger_entries.length).toBe(1);
  });

  it("rejects approval attempts from unauthorized members (RBAC violation)", async () => {
    const depositService = new DepositService(mockSupabase);

    await expect(
      depositService.reviewDeposit({
        depositId: "dep-001",
        action: "approve",
        reviewerLineUserId: "U_MEMBER", // Regular member, not owner/treasurer
      })
    ).rejects.toThrow(/UNAUTHORIZED_REVIEWER/);

    // Verify deposit remains pending
    const dep = mockDatabase.deposits.find((d) => d.id === "dep-001");
    expect(dep.status).toBe("pending");
  });
});

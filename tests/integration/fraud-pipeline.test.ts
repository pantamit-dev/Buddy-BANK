import { describe, it, expect, beforeEach } from "vitest";
import { DepositService } from "@/modules/deposits/service";
import { computeFileSha256 } from "@/modules/fraud/hash";

describe("Slip Fraud Detection Pipeline Integration Tests", () => {
  let mockDatabase: {
    deposits: any[];
    transactions: any[];
    ledger_entries: any[];
    profiles: any[];
    group_members: any[];
  };

  let mockSupabase: any;
  let depositService: DepositService;

  beforeEach(() => {
    mockDatabase = {
      profiles: [
        { id: "p-owner", line_user_id: "U_OWNER", display_name: "Alice Owner" },
        { id: "p-member", line_user_id: "U_MEMBER", display_name: "Bob Member" },
      ],
      group_members: [
        {
          id: "gm-owner",
          group_id: "g-pool-1",
          user_id: "p-owner",
          role: "owner",
          status: "active",
          profiles: { id: "p-owner", line_user_id: "U_OWNER", display_name: "Alice Owner" },
        },
        {
          id: "gm-member",
          group_id: "g-pool-1",
          user_id: "p-member",
          role: "member",
          status: "active",
          profiles: { id: "p-member", line_user_id: "U_MEMBER", display_name: "Bob Member" },
        },
      ],
      deposits: [],
      transactions: [],
      ledger_entries: [],
    };

    mockSupabase = {
      storage: {
        from: () => ({
          upload: async (path: string) => ({ data: { path }, error: null }),
        }),
      },
      from: (table: string) => ({
        insert: (payload: any) => ({
          select: () => ({
            single: async () => {
              const record = {
                id: `dep-${mockDatabase.deposits.length + 1}`,
                ...payload,
                created_at: new Date().toISOString(),
              };
              (mockDatabase as any)[table]?.push(record);
              return { data: record, error: null };
            },
          }),
        }),
        select: (cols: string) => ({
          eq: (f1: string, v1: any) => {
            const chain: any = {
              eq: (f2: string, v2: any) => ({
                in: (f3: string, v3: any[]) => ({
                  maybeSingle: async () => {
                    const match = (mockDatabase as any)[table]?.find(
                      (r: any) => r[f1] === v1 && r[f2] === v2 && v3.includes(r[f3])
                    );
                    return { data: match || null, error: null };
                  },
                }),
                maybeSingle: async () => {
                  const match = (mockDatabase as any)[table]?.find(
                    (r: any) => r[f1] === v1 && r[f2] === v2
                  );
                  return { data: match || null, error: null };
                },
              }),
              in: (f2: string, v2: any[]) => ({
                maybeSingle: async () => {
                  const match = (mockDatabase as any)[table]?.find(
                    (r: any) => r[f1] === v1 && v2.includes(r[f2])
                  );
                  return { data: match || null, error: null };
                },
              }),
              not: (f2: string, op: string, v2: any) => ({
                in: (f3: string, v3: any[]) => ({
                  limit: async (lim: number) => {
                    const list = (mockDatabase as any)[table]?.filter(
                      (r: any) => r[f1] === v1 && r[f2] !== null && v3.includes(r[f3])
                    );
                    return { data: list?.slice(0, lim) || [], error: null };
                  },
                }),
              }),
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
                if (table === "profiles") {
                  const match = mockDatabase.profiles.find((p) => p.line_user_id === v1);
                  return { data: match || null, error: null };
                }
                const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
                return { data: match || null, error: null };
              },
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
                  single: async () => {
                    const match = (mockDatabase as any)[table]?.find(
                      (r: any) => r[f1] === v1 && r[f2] === v2
                    );
                    if (!match) return { data: null, error: new Error("Not found") };
                    Object.assign(match, payload);
                    return { data: match, error: null };
                  },
                }),
              }),
              select: () => ({
                single: async () => {
                  const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
                  if (match) Object.assign(match, payload);
                  return { data: match, error: null };
                },
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

    depositService = new DepositService(mockSupabase);
  });

  it("assigns 'pending' to a clean legitimate slip with sha256 and phash recorded", async () => {
    const slipBuffer = Buffer.from("CLEAN_LEGITIMATE_SLIP_IMAGE_2026_A");
    const deposit = await depositService.createPendingDeposit({
      groupId: "g-pool-1",
      memberId: "gm-member",
      imageBuffer: slipBuffer,
      rawOcrText: "โอนเงินสำเร็จ 1,500.00 บาท วันที่ 21 พ.ย. 2569",
      detectedAmount: 1500,
      bankReference: "KBANK_CLEAN_001",
    });

    expect(deposit).toBeDefined();
    expect(deposit.status).toBe("pending");
    expect(deposit.file_sha256).toBe(computeFileSha256(slipBuffer));
    expect(deposit.fraud_risk_score).toBeLessThan(50);
  });

  it("automatically routes duplicate file re-upload to 'needs_review' queue with high risk score", async () => {
    const slipBuffer = Buffer.from("IDENTICAL_SLIP_BINARY_DATA_REPEAT");

    // 1. First upload (clean)
    const firstDeposit = await depositService.createPendingDeposit({
      groupId: "g-pool-1",
      memberId: "gm-member",
      imageBuffer: slipBuffer,
      rawOcrText: "โอนเงินสำเร็จ 1,000.00 บาท",
      detectedAmount: 1000,
      bankReference: "REF_ORIGINAL_FIRST",
    });
    expect(firstDeposit.status).toBe("pending");

    // 2. Second upload of the EXACT same binary file with different ref attempt
    const secondDeposit = await depositService.createPendingDeposit({
      groupId: "g-pool-1",
      memberId: "gm-member",
      imageBuffer: slipBuffer,
      rawOcrText: "โอนเงินสำเร็จ 1,000.00 บาท",
      detectedAmount: 1000,
      bankReference: "REF_ATTEMPT_DIFFERENT",
    });

    expect(secondDeposit).toBeDefined();
    expect(secondDeposit.status).toBe("needs_review"); // Flagged into suspicious queue!
    expect(secondDeposit.fraud_risk_score).toBeGreaterThanOrEqual(60);
  });

  it("allows owner to review and approve a deposit currently in 'needs_review' status", async () => {
    // Insert a deposit currently stuck in needs_review
    mockDatabase.deposits.push({
      id: "dep-suspicious-1",
      group_id: "g-pool-1",
      member_id: "gm-member",
      detected_amount: 2500,
      status: "needs_review",
      click_count: 0,
      fraud_risk_score: 75,
    });

    // Owner reviews and approves
    const reviewResult = await depositService.reviewDeposit({
      depositId: "dep-suspicious-1",
      action: "approve",
      reviewerLineUserId: "U_OWNER",
    });

    expect(reviewResult.success).toBe(true);
    expect(reviewResult.action).toBe("approve");
    expect(reviewResult.deposit?.status).toBe("verified");

    // Verified ledger entry committed
    expect(mockDatabase.ledger_entries.length).toBe(1);
    expect(mockDatabase.ledger_entries[0].amount).toBe(2500);
    expect(mockDatabase.ledger_entries[0].entry_type).toBe("credit");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/dev/reset-transactions/route";
import { NextRequest } from "next/server";

// Mock createAdminClient from @/integrations/supabase/server
vi.mock("@/integrations/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/integrations/supabase/server";

describe("POST /api/dev/reset-transactions Integration Tests", () => {
  let mockSupabase: any;
  let mockDatabase: {
    groups: any[];
    profiles: any[];
    group_members: any[];
    deposits: any[];
    transactions: any[];
    ledger_entries: any[];
    audit_logs: any[];
    storage_slips: any[];
  };

  beforeEach(() => {
    mockDatabase = {
      groups: [
        {
          id: "g-reset-1",
          name: "กลุ่มเพื่อนเที่ยว",
          owner_id: "p-owner-1",
          target_amount: 50000,
        },
      ],
      profiles: [
        { id: "p-owner-1", line_user_id: "U_OWNER_123", display_name: "Owner User" },
        { id: "p-member-1", line_user_id: "U_MEMBER_456", display_name: "Regular Member" },
      ],
      group_members: [
        {
          id: "gm-owner-1",
          group_id: "g-reset-1",
          user_id: "p-owner-1",
          role: "owner",
          status: "active",
          profiles: { line_user_id: "U_OWNER_123" },
        },
        {
          id: "gm-member-1",
          group_id: "g-reset-1",
          user_id: "p-member-1",
          role: "member",
          status: "active",
          profiles: { line_user_id: "U_MEMBER_456" },
        },
      ],
      deposits: [
        { id: "dep-1", group_id: "g-reset-1", status: "verified", detected_amount: 500 },
        { id: "dep-2", group_id: "g-reset-1", status: "pending", detected_amount: 1000 },
      ],
      transactions: [
        { id: "tx-1", group_id: "g-reset-1", deposit_id: "dep-1", amount: 500 },
      ],
      ledger_entries: [
        { id: "led-1", group_id: "g-reset-1", transaction_id: "tx-1", amount: 500 },
      ],
      audit_logs: [],
      storage_slips: [{ name: "slip1.jpg" }],
    };

    mockSupabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn((cols: string) => ({
          eq: vi.fn((f1: string, v1: any) => ({
            eq: vi.fn((f2: string, v2: any) => ({
              maybeSingle: vi.fn(async () => {
                if (table === "group_members") {
                  const m = mockDatabase.group_members.find(
                    (row) => row.group_id === v1 && row.profiles.line_user_id === v2
                  );
                  return { data: m || null };
                }
                return { data: null };
              }),
            })),
            maybeSingle: vi.fn(async () => {
              if (table === "groups") {
                const g = mockDatabase.groups.find((row) => row.id === v1);
                return { data: g || null };
              }
              return { data: null };
            }),
          })),
          limit: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: mockDatabase.groups[0] || null })),
          })),
        })),
        insert: vi.fn(async (payload: any) => {
          if (table === "audit_logs") {
            mockDatabase.audit_logs.push(payload);
          }
          return { data: payload, error: null };
        }),
      })),
      rpc: vi.fn(async (funcName: string, args: any) => {
        if (funcName === "reset_group_transactions") {
          const deletedDeposits = mockDatabase.deposits.length;
          const deletedTransactions = mockDatabase.transactions.length;
          const deletedLedger = mockDatabase.ledger_entries.length;

          // Clear transactions, deposits, ledger
          mockDatabase.deposits = [];
          mockDatabase.transactions = [];
          mockDatabase.ledger_entries = [];

          return {
            data: {
              success: true,
              deleted_deposits: deletedDeposits,
              deleted_transactions: deletedTransactions,
              deleted_ledger: deletedLedger,
              deleted_withdrawals: 0,
              deleted_reports: 0,
            },
            error: null,
          };
        }
        return { data: null, error: new Error("Unknown RPC") };
      }),
      storage: {
        from: vi.fn((bucket: string) => ({
          list: vi.fn(async (path: string) => ({
            data: mockDatabase.storage_slips,
            error: null,
          })),
          remove: vi.fn(async (paths: string[]) => {
            mockDatabase.storage_slips = [];
            return { data: paths, error: null };
          }),
        })),
      },
    };

    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  it("rejects non-owner members with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/dev/reset-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: "g-reset-1",
        actorLineUserId: "U_MEMBER_456",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("เฉพาะหัวหน้ากลุ่ม (Owner)");

    // Database must not be touched
    expect(mockDatabase.deposits.length).toBe(2);
    expect(mockDatabase.transactions.length).toBe(1);
    expect(mockDatabase.ledger_entries.length).toBe(1);
  });

  it("successfully resets transactions, deposits, ledger, and storage for Owner while keeping profiles and settings", async () => {
    const req = new NextRequest("http://localhost:3000/api/dev/reset-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: "g-reset-1",
        actorLineUserId: "U_OWNER_123",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.message).toContain("รีเซ็ตข้อมูลการฝากและรายการตรวจสอบเรียบร้อยแล้ว");
    expect(json.details.deleted_deposits).toBe(2);
    expect(json.details.deleted_transactions).toBe(1);
    expect(json.details.deleted_ledger).toBe(1);

    // 1. Transaction data is cleared
    expect(mockDatabase.deposits.length).toBe(0);
    expect(mockDatabase.transactions.length).toBe(0);
    expect(mockDatabase.ledger_entries.length).toBe(0);

    // 2. Profiles, Groups, and Members are STRICTLY PRESERVED
    expect(mockDatabase.profiles.length).toBe(2);
    expect(mockDatabase.groups.length).toBe(1);
    expect(mockDatabase.groups[0].name).toBe("กลุ่มเพื่อนเที่ยว");
    expect(mockDatabase.group_members.length).toBe(2);

    // 3. Storage slips cleared
    expect(mockDatabase.storage_slips.length).toBe(0);

    // 4. Audit log recorded
    expect(mockDatabase.audit_logs.length).toBe(1);
    expect(mockDatabase.audit_logs[0].action).toBe("DEV_RESET_TRANSACTIONS");
  });

  it("allows dev mode execution when actor is mock owner", async () => {
    const req = new NextRequest("http://localhost:3000/api/dev/reset-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: "g-reset-1",
        actorLineUserId: "U_OWNER_001",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});

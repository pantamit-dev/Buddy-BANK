import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandHandler } from "@/modules/commands/handler";

// Mock Supabase admin client and modules
vi.mock("@/integrations/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "groups") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "group-uuid-1",
                  name: "กลุ่มทริปท่องเที่ยว",
                  target_amount: 10000,
                },
              }),
            }),
          }),
        };
      }

      const makeQuery = (data: any = [], count?: number) => {
        const obj: any = {
          data,
          count,
          select: () => obj,
          eq: (col: string, val: any) => {
            if (col === "status" && val === "active" && table === "group_members") {
              return { ...obj, count: 5 };
            }
            return obj;
          },
          order: () => obj,
          limit: () => obj,
          then: (resolve: any) =>
            resolve({
              data,
              count: count || (table === "group_members" ? 5 : 0),
            }),
        };
        return obj;
      };

      if (table === "group_members") {
        return makeQuery(
          [
            {
              id: "m-1",
              role: "owner",
              status: "active",
              profiles: { id: "p-1", display_name: "สมชาย", picture_url: null },
            },
            {
              id: "m-2",
              role: "treasurer",
              status: "active",
              profiles: { id: "p-2", display_name: "สมหญิง", picture_url: null },
            },
          ],
          5
        );
      }

      if (table === "deposits") {
        return makeQuery([
          {
            detected_amount: 500,
            created_at: new Date().toISOString(),
            status: "verified",
            group_members: { profiles: { display_name: "สมชาย" } },
          },
        ]);
      }

      return makeQuery([]);
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async () => ({
          data: { signedUrl: "https://example.com/qr.png" },
          error: null,
        }),
      }),
    },
  }),
}));

vi.mock("@/modules/ledger/service", () => ({
  LedgerService: vi.fn().mockImplementation(() => ({
    getGroupBalanceSummary: async () => ({
      totalBalance: 6000,
      totalCredit: 6000,
      totalDebit: 0,
      targetAmount: 10000,
      percentage: 60.0,
      remainingAmount: 4000,
    }),
    getMemberContribution: async () => ({
      personalTotal: 2000,
      personalSharePercentage: 33.33,
    }),
  })),
}));

vi.mock("@/modules/membership/service", () => ({
  MembershipService: vi.fn().mockImplementation(() => ({
    getMemberByLineUserId: async () => ({
      memberId: "member-uuid-1",
      displayName: "สมชาย",
      role: "member",
      status: "active",
    }),
  })),
}));

describe("Chat Command Router Unit Tests", () => {
  let commandHandler: CommandHandler;

  beforeEach(() => {
    commandHandler = new CommandHandler();
  });

  it("ignores messages that do not start with '#'", async () => {
    const result = await commandHandler.handleCommand({
      text: "สวัสดีทุกคน วันนี้กินอะไรดี",
      lineGroupId: "group_123",
      lineUserId: "user_123",
    });
    expect(result).toBeNull();
  });

  it("handles '#ยอดรวม' and returns formatted FlexMessage", async () => {
    const result = await commandHandler.handleCommand({
      text: "#ยอดรวม",
      lineGroupId: "group_123",
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe("flex");
    expect(result?.altText).toContain("สรุปยอดกองกลาง");
  });

  it("handles alias '#สรุป' same as '#ยอดรวม'", async () => {
    const result = await commandHandler.handleCommand({
      text: "#สรุป",
      lineGroupId: "group_123",
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe("flex");
    expect(result?.altText).toContain("สรุปยอดกองกลาง");
  });

  it("handles '#ยอดฉัน' and returns personal balance FlexMessage", async () => {
    const result = await commandHandler.handleCommand({
      text: "#ยอดฉัน",
      lineGroupId: "group_123",
      lineUserId: "user_123",
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe("flex");
    expect(result?.altText).toContain("ยอดสมทบของคุณ");
  });

  it("handles alias '#ยอดผม'", async () => {
    const result = await commandHandler.handleCommand({
      text: "#ยอดผม",
      lineGroupId: "group_123",
      lineUserId: "user_123",
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe("flex");
    expect(result?.altText).toContain("ยอดสมทบของคุณ");
  });

  it("handles '#ช่วยเหลือ' and '#help' command", async () => {
    const helpResult = await commandHandler.handleCommand({
      text: "#ช่วยเหลือ",
      lineGroupId: "group_123",
    });
    expect(helpResult).not.toBeNull();
    expect(helpResult?.altText).toContain("คำแนะนำการใช้งาน");

    const engResult = await commandHandler.handleCommand({
      text: "#help",
      lineGroupId: "group_123",
    });
    expect(engResult).not.toBeNull();
  });

  it("returns registration prompt when #ยอดฉัน is sent by unregistered or non-active member", async () => {
    // Override membership to return null
    (commandHandler as any).membershipService.getMemberByLineUserId = vi.fn().mockResolvedValue(null);

    const result = await commandHandler.handleCommand({
      text: "#ยอดฉัน",
      lineGroupId: "group_123",
      lineUserId: "user_unknown",
    });

    expect(result).not.toBeNull();
    expect(result?.altText).toContain("คุณยังไม่ได้เป็นสมาชิก");
  });

  it("handles '#โอนเงิน' and '#qr' commands with and without amount", async () => {
    const noAmountResult = await commandHandler.handleCommand({
      text: "#โอนเงิน",
      lineGroupId: "group_123",
    });
    expect(noAmountResult).not.toBeNull();
    expect(noAmountResult?.type).toBe("flex");
    expect(noAmountResult?.altText).toContain("โอนเงินเข้ากองกลาง");

    const withAmountResult = await commandHandler.handleCommand({
      text: "#qr 300",
      lineGroupId: "group_123",
    });
    expect(withAmountResult).not.toBeNull();
    expect(withAmountResult?.type).toBe("flex");
    expect(withAmountResult?.altText).toContain("300.00");
  });

  it("handles '#รายชื่อ' and '#สมาชิก' to display roster and individual balances with quickReply chips", async () => {
    const result = await commandHandler.handleCommand({
      text: "#รายชื่อ",
      lineGroupId: "group_123",
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe("flex");
    expect(result?.altText).toContain("รายชื่อสมาชิกกองกลาง");
    expect(result?.quickReply).toBeDefined();
    expect(result?.quickReply?.items.length).toBeGreaterThanOrEqual(4);
  });

  it("handles '#ประวัติ' to display recent transactions", async () => {
    const result = await commandHandler.handleCommand({
      text: "#ประวัติ",
      lineGroupId: "group_123",
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe("flex");
    expect(result?.altText).toContain("ประวัติการโอนเงินล่าสุด");
    expect(result?.quickReply).toBeDefined();
  });

  it("attaches common quickReply buttons to #ยอดรวม response", async () => {
    const result = await commandHandler.handleCommand({
      text: "#ยอดรวม",
      lineGroupId: "group_123",
    });

    expect(result?.quickReply).toBeDefined();
    const labels = result?.quickReply?.items.map((i: any) => i.action?.label);
    expect(labels).toContain("📊 ยอดรวม");
    expect(labels).toContain("👤 ยอดฉัน");
    expect(labels).toContain("👥 รายชื่อ");
  });

  it("ignores unknown hash commands silently (e.g. #random_tag)", async () => {
    const result = await commandHandler.handleCommand({
      text: "#ร้านอาหารแนะนำ",
      lineGroupId: "group_123",
    });
    expect(result).toBeNull();
  });
});

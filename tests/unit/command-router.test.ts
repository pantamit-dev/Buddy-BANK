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
      if (table === "group_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 5 }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [] }),
        }),
      };
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

  it("ignores unknown hash commands silently (e.g. #random_tag)", async () => {
    const result = await commandHandler.handleCommand({
      text: "#ร้านอาหารแนะนำ",
      lineGroupId: "group_123",
    });
    expect(result).toBeNull();
  });
});

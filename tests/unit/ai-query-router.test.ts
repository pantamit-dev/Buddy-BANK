import { describe, it, expect, beforeEach } from "vitest";
import { HybridAiQueryRouter } from "@/modules/ai/query-router";
import { sanitizeGroupResponse } from "@/modules/ai/privacy-filter";
import { MiniAppCopilotService } from "@/modules/ai/copilot";

describe("Hybrid AI Router, Privacy Filter & Copilot Unit Tests", () => {
  describe("Bot Mention Detection & Intent Classification", () => {
    it("detects bot mentions properly", () => {
      expect(HybridAiQueryRouter.isBotMention("@MoneyPoolBot ตอนนี้ยอดถึงไหนแล้ว")).toBe(true);
      expect(HybridAiQueryRouter.isBotMention("@bot ยอดรวม")).toBe(true);
      expect(HybridAiQueryRouter.isBotMention("น้องบอท ช่วยสรุปยอดหน่อย")).toBe(true);
      expect(HybridAiQueryRouter.isBotMention("บอท ใครยังไม่จ่าย")).toBe(true);
      expect(HybridAiQueryRouter.isBotMention("#ยอดรวม")).toBe(false);
      expect(HybridAiQueryRouter.isBotMention("โอนเงินแล้วนะ")).toBe(false);
    });

    it("extracts clean query text stripped of bot prefix", () => {
      expect(HybridAiQueryRouter.extractQueryText("@MoneyPoolBot ยอดถึงไหนแล้ว")).toBe("ยอดถึงไหนแล้ว");
      expect(HybridAiQueryRouter.extractQueryText("@bot ใครยังไม่จ่าย")).toBe("ใครยังไม่จ่าย");
      expect(HybridAiQueryRouter.extractQueryText("น้องบอท สรุปยอด")).toBe("สรุปยอด");
    });

    it("classifies intent into progress, unpaid, transactions, or general_help", () => {
      const router = new HybridAiQueryRouter({} as any);

      expect(router.classifyIntent("ตอนนี้ยอดถึงไหนแล้ว").intent).toBe("progress");
      expect(router.classifyIntent("ใครยังไม่จ่ายเงินบ้าง").intent).toBe("unpaid");
      expect(router.classifyIntent("ขอดูรายการโอนล่าสุด").intent).toBe("transactions");
      expect(router.classifyIntent("ทำอะไรได้บ้าง").intent).toBe("general_help");
    });
  });

  describe("Group Privacy Filter", () => {
    it("masks bank account numbers and phone numbers", () => {
      const input = "โอนเข้าบัญชี 123-4-56789-0 หรือพร้อมเพย์ 0891234567 ยอด 500 บาท";
      const sanitized = sanitizeGroupResponse(input);

      expect(sanitized).not.toContain("123-4-56789-0");
      expect(sanitized).not.toContain("0891234567");
      expect(sanitized).toContain("123-x-xxxxx-0");
      expect(sanitized).toContain("089-xxx-4567");
    });

    it("handles 10-digit unhyphenated bank account numbers", () => {
      const input = "เลขที่บัญชีคือ 0123456789";
      const sanitized = sanitizeGroupResponse(input);

      expect(sanitized).not.toContain("0123456789");
      expect(sanitized).toContain("012xxxx789");
    });
  });

  describe("Mini App Copilot Multi-Turn Chat & Analytical Forecasting", () => {
    let mockSupabase: any;
    let copilot: MiniAppCopilotService;

    beforeEach(() => {
      const deposits = [
        {
          id: "d-1",
          detected_amount: 2500,
          created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
          status: "verified",
          group_members: { profiles: { display_name: "Alice" } },
        },
        {
          id: "d-2",
          detected_amount: 2500,
          created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
          status: "verified",
          group_members: { profiles: { display_name: "Bob" } },
        },
      ];

      mockSupabase = {
        from: (table: string) => ({
          select: (cols: string) => ({
            eq: (f1: string, v1: any) => {
              const chain: any = {
                eq: (f2: string, v2: any) => ({
                  then: (resolve: any) => {
                    if (table === "deposits") {
                      resolve({ data: deposits, error: null });
                    } else if (table === "group_members") {
                      resolve({
                        data: [
                          { id: "gm-1", role: "owner", status: "active", profiles: { display_name: "Alice" } },
                          { id: "gm-2", role: "member", status: "active", profiles: { display_name: "Bob" } },
                        ],
                        error: null,
                      });
                    } else {
                      resolve({ data: [], error: null });
                    }
                  },
                }),
                single: async () => {
                  return { data: { name: "Japan Trip", target_amount: 10000 }, error: null };
                },
                maybeSingle: async () => {
                  return { data: { name: "Japan Trip", target_amount: 10000 }, error: null };
                },
              };
              chain.then = (resolve: any) => {
                if (table === "deposits") resolve({ data: deposits, error: null });
                else resolve({ data: [], error: null });
              };
              return chain;
            },
          }),
        }),
      };

      copilot = new MiniAppCopilotService(mockSupabase);
    });

    it("generates chart payloads when user requests graphical breakdown", async () => {
      const response = await copilot.chat({
        groupId: "g-japan",
        messages: [{ role: "user", content: "ขอดูกราฟยอดสมทบของสมาชิก" }],
      });

      expect(response.replyText).toBeDefined();
      expect(response.chart).toBeDefined();
      expect(response.chart?.type).toBe("bar");
      expect(response.chart?.labels).toContain("Alice");
      expect(response.chart?.labels).toContain("Bob");
      expect(response.suggestions).toBeDefined();
    });

    it("forecasts goal completion date based on average savings pace", async () => {
      const response = await copilot.chat({
        groupId: "g-japan",
        messages: [{ role: "user", content: "คาดการณ์ว่าจะเก็บเงินถึงเป้าเมื่อไหร่" }],
      });

      expect(response.replyText).toContain("เป้าหมาย");
      expect(response.insights).toBeDefined();
    });
  });
});

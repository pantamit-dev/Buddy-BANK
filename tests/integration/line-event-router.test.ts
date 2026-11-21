import { describe, it, expect, vi, beforeEach } from "vitest";
import { LineEventRouter } from "@/modules/line-webhook/event-router";
import type { WebhookEvent } from "@line/bot-sdk";

describe("LINE Event Router Integration Tests", () => {
  let router: LineEventRouter;
  let mockLineClient: any;
  let mockDatabase: {
    groups: any[];
    profiles: any[];
    group_members: any[];
    deposits: any[];
    transactions: any[];
    ledger_entries: any[];
    webhook_events: any[];
  };

  beforeEach(() => {
    mockDatabase = {
      groups: [
        {
          id: "g-test-1",
          line_group_id: "C_GROUP_001",
          name: "Test Group",
          target_amount: 10000,
          owner_id: "p-owner-1",
        },
      ],
      profiles: [
        { id: "p-owner-1", line_user_id: "U_OWNER", display_name: "Owner User" },
        { id: "p-active-1", line_user_id: "U_ACTIVE", display_name: "Active Member" },
        { id: "p-pending-1", line_user_id: "U_PENDING", display_name: "Pending Member" },
      ],
      group_members: [
        {
          id: "gm-owner-1",
          group_id: "g-test-1",
          user_id: "p-owner-1",
          role: "owner",
          status: "active",
          profiles: { id: "p-owner-1", line_user_id: "U_OWNER", display_name: "Owner User" },
        },
        {
          id: "gm-active-1",
          group_id: "g-test-1",
          user_id: "p-active-1",
          role: "member",
          status: "active",
          profiles: { id: "p-active-1", line_user_id: "U_ACTIVE", display_name: "Active Member" },
        },
        {
          id: "gm-pending-1",
          group_id: "g-test-1",
          user_id: "p-pending-1",
          role: "member",
          status: "pending_approval",
          profiles: { id: "p-pending-1", line_user_id: "U_PENDING", display_name: "Pending Member" },
        },
      ],
      deposits: [],
      transactions: [],
      ledger_entries: [],
      webhook_events: [],
    };

    mockLineClient = {
      replyMessage: vi.fn().mockResolvedValue({}),
      pushMessage: vi.fn().mockResolvedValue({}),
      showLoadingAnimation: vi.fn().mockResolvedValue(true),
      getMessageContent: vi.fn().mockResolvedValue(Buffer.from("fake_image_bytes")),
      getGroupMemberProfile: vi.fn().mockResolvedValue({
        displayName: "LINE User",
        pictureUrl: "https://example.com/pic.jpg",
      }),
    };

    router = new LineEventRouter(mockLineClient);

    // Mock router's Supabase queries
    const mockSupabase = {
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
        insert: (payload: any) => {
          const inserted = { id: `id-${Math.random()}`, ...payload };
          (mockDatabase as any)[table]?.push(inserted);
          return {
            select: () => ({
              single: async () => ({ data: inserted, error: null }),
            }),
          };
        },
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
      }),
      storage: {
        from: () => ({
          upload: async () => ({ data: { path: "slips/test.jpg" }, error: null }),
          createSignedUrl: async () => ({ data: { signedUrl: "https://example.com/slip.jpg" } }),
        }),
      },
    };

    (router as any).supabase = mockSupabase;
    (router as any).depositService.supabase = mockSupabase;
    (router as any).membershipService.supabase = mockSupabase;
  });

  it("handles 'join' event by creating group and replying with welcome flex message", async () => {
    const event: any = {
      type: "join",
      replyToken: "reply_join_1",
      source: { type: "group", groupId: "C_NEW_GROUP" },
    };

    const results = await router.handleEvents([event]);
    expect(results[0].success).toBe(true);
    expect(mockLineClient.replyMessage).toHaveBeenCalledTimes(1);
    const [, messages] = mockLineClient.replyMessage.mock.calls[0];
    expect(messages[0].type).toBe("flex");
    expect(messages[0].altText).toContain("ยินดีต้อนรับสู่ Money Pool");
  });

  it("strictly rejects slip uploads from unregistered users and sends registration prompt", async () => {
    const event: any = {
      type: "message",
      replyToken: "reply_img_unreg",
      source: { type: "group", groupId: "C_GROUP_001", userId: "U_STRANGER" },
      message: { id: "msg_img_1", type: "image" },
    };

    const results = await router.handleEvents([event]);
    expect(results[0].success).toBe(false);
    expect(results[0].reason).toBe("MEMBER_NOT_REGISTERED");

    // Must have sent registration required Flex message
    expect(mockLineClient.replyMessage).toHaveBeenCalledTimes(1);
    const [, messages] = mockLineClient.replyMessage.mock.calls[0];
    expect(messages[0].altText).toContain("กรุณาลงทะเบียนก่อนส่งสลิป");
  });

  it("strictly rejects slip uploads from members pending approval", async () => {
    const event: any = {
      type: "message",
      replyToken: "reply_img_pending",
      source: { type: "group", groupId: "C_GROUP_001", userId: "U_PENDING" },
      message: { id: "msg_img_2", type: "image" },
    };

    const results = await router.handleEvents([event]);
    expect(results[0].success).toBe(false);
    expect(results[0].reason).toBe("MEMBER_NOT_ACTIVE");

    expect(mockLineClient.replyMessage).toHaveBeenCalledTimes(1);
    const [, messages] = mockLineClient.replyMessage.mock.calls[0];
    expect(messages[0].altText).toContain("บัญชีอยู่ระหว่างรอการอนุมัติ");
  });

  it("rejects postback approvals from non-owner/treasurer members with authorization warning", async () => {
    mockDatabase.deposits.push({
      id: "dep-test-1",
      group_id: "g-test-1",
      member_id: "gm-active-1",
      status: "pending",
      detected_amount: 500.0,
      click_count: 0,
    });

    const event: any = {
      type: "postback",
      replyToken: "reply_pb_unauth",
      source: { type: "group", groupId: "C_GROUP_001", userId: "U_ACTIVE" }, // Regular member
      postback: { data: "action=approve&depositId=dep-test-1" },
    };

    const results = await router.handleEvents([event]);
    expect(results[0].success).toBe(false);
    expect(results[0].reason).toBe("UNAUTHORIZED_REVIEWER");

    // Chat receives friendly warning
    expect(mockLineClient.replyMessage).toHaveBeenCalledTimes(1);
    const [, messages] = mockLineClient.replyMessage.mock.calls[0];
    expect(messages[0].text).toContain("เฉพาะเจ้าของกลุ่มหรือเหรัญญิกเท่านั้น");
  });

  it("guards against approving a deposit when amount is missing / null", async () => {
    mockDatabase.deposits.push({
      id: "dep-no-amount",
      group_id: "g-test-1",
      member_id: "gm-active-1",
      status: "pending",
      detected_amount: null,
      click_count: 0,
    });

    const event: any = {
      type: "postback",
      replyToken: "reply_pb_no_amt",
      source: { type: "group", groupId: "C_GROUP_001", userId: "U_OWNER" },
      postback: { data: "action=approve&depositId=dep-no-amount" },
    };

    const results = await router.handleEvents([event]);
    expect(results[0].success).toBe(false);
    expect(results[0].reason).toBe("AMOUNT_REQUIRED");

    expect(mockLineClient.replyMessage).toHaveBeenCalledTimes(1);
    const [, messages] = mockLineClient.replyMessage.mock.calls[0];
    expect(messages[0].text).toContain("ตรวจไม่พบยอดเงินในสลิป");
  });
});

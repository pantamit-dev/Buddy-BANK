import { LedgerService } from "@/modules/ledger/service";
import { MembershipService } from "@/modules/membership/service";
import {
  createGroupBalanceFlexMessage,
  createPersonalBalanceFlexMessage,
  createHelpFlexMessage,
  createPromptPayFlexMessage,
} from "@/modules/line-webhook/flex-templates";
import { createAdminClient } from "@/integrations/supabase/server";
import type { messagingApi } from "@line/bot-sdk";

export class CommandHandler {
  private ledgerService: LedgerService;
  private membershipService: MembershipService;
  private supabase = createAdminClient();

  constructor() {
    this.ledgerService = new LedgerService(this.supabase);
    this.membershipService = new MembershipService(this.supabase);
  }

  /**
   * Deterministically processes chat messages starting with '#'
   * Returns a FlexMessage or null if message is not an actionable command
   */
  async handleCommand(params: {
    text: string;
    lineGroupId: string;
    lineUserId?: string;
  }): Promise<messagingApi.FlexMessage | null> {
    const { text, lineGroupId, lineUserId } = params;
    const trimmed = text.trim();

    if (!trimmed.startsWith("#")) {
      return null;
    }

    const command = trimmed.toLowerCase();
    const liffUrl = process.env.NEXT_PUBLIC_LIFF_ID
      ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
      : "https://line.me";

    // 1. Resolve internal group_id from line_group_id
    const { data: group } = await this.supabase
      .from("groups")
      .select("id, name, target_amount")
      .eq("line_group_id", lineGroupId)
      .maybeSingle();

    if (!group) {
      // If group is not registered in system, ignore or return help
      return null;
    }

    // 2. Command: #ยอดรวม / #สรุป (Parallelized summary with preloaded target amount)
    if (command === "#ยอดรวม" || command === "#สรุป") {
      const targetAmount = Number(group.target_amount || 0);
      const [summary, membersCountRes] = await Promise.all([
        this.ledgerService.getGroupBalanceSummary(group.id, targetAmount),
        this.supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id)
          .eq("status", "active"),
      ]);

      return createGroupBalanceFlexMessage({
        groupName: group.name,
        totalBalance: summary.totalBalance,
        targetAmount: summary.targetAmount,
        percentage: summary.percentage,
        memberCount: membersCountRes.count || 1,
        liffUrl,
      });
    }

    // 3. Command: #ยอดฉัน / #ยอดผม
    if (command === "#ยอดฉัน" || command === "#ยอดผม") {
      if (!lineUserId) {
        return null;
      }

      const member = await this.membershipService.getMemberByLineUserId(
        group.id,
        lineUserId
      );

      if (!member || member.status !== "active") {
        return {
          type: "flex",
          altText: "คุณยังไม่ได้เป็นสมาชิกของกองกลางนี้",
          contents: {
            type: "bubble",
            body: {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: "⚠️ ตรวจสอบสถานะสมาชิก",
                  weight: "bold",
                  color: "#d97706",
                  size: "md",
                },
                {
                  type: "text",
                  text: member?.status === "pending_approval"
                    ? "การสมัครสมาชิกของคุณอยู่ระหว่างรอเจ้าของกลุ่มอนุมัติ จึงยังไม่สามารถดูยอดสะสมได้"
                    : "คุณยังไม่ได้ลงทะเบียนเป็นสมาชิกในกลุ่มนี้ กรุณากดลงทะเบียนผ่าน Mini App ก่อนตรวจสอบยอด",
                  size: "xs",
                  color: "#475569",
                  wrap: true,
                },
              ],
            },
            footer: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  color: "#059669",
                  action: {
                    type: "uri",
                    label: "📱 เปิดระบบ Mini App",
                    uri: liffUrl,
                  },
                },
              ],
            },
          },
        };
      }

      const summary = await this.ledgerService.getGroupBalanceSummary(group.id);
      const contribution = await this.ledgerService.getMemberContribution(
        group.id,
        member.memberId
      );

      return createPersonalBalanceFlexMessage({
        memberName: member.displayName,
        personalTotal: contribution.personalTotal,
        groupTotal: summary.totalBalance,
        percentageOfPool: contribution.personalSharePercentage,
      });
    }

    // 4. Command: #ช่วยเหลือ / #คำสั่ง
    if (command === "#ช่วยเหลือ" || command === "#คำสั่ง" || command === "#help") {
      return createHelpFlexMessage(liffUrl);
    }

    // 5. Command: #โอนเงิน / #โอน / #qr
    if (
      command.startsWith("#โอนเงิน") ||
      command.startsWith("#โอน") ||
      command.startsWith("#qr")
    ) {
      // Parse optional amount: e.g. #โอนเงิน 300 or #qr 500
      const parts = trimmed.split(/\s+/);
      let amount: number | null = null;
      if (parts.length > 1) {
        const parsed = parseFloat(parts[1].replace(/,/g, ""));
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed;
        }
      }

      // Fetch group rules / settings if available
      const { data: groupWithSettings } = await this.supabase
        .from("groups")
        .select("name, group_settings(rules)")
        .eq("id", group.id)
        .maybeSingle();

      const rules = (groupWithSettings?.group_settings as any)?.rules;
      const target = rules?.promptpay_id || "081-234-5678";
      const bankAccountNo = rules?.bank_account_no || "123-4-56789-0";
      const bankName = rules?.bank_name || "กสิกรไทย (KBANK)";
      const accountName = rules?.account_name || group.name;

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
      const qrImageUrl = appUrl
        ? `${appUrl}/api/promptpay/generate?groupId=${group.id}&format=image${
            amount ? `&amount=${amount}` : ""
          }`
        : undefined;

      return createPromptPayFlexMessage({
        groupName: group.name,
        amount,
        target,
        accountName,
        bankName,
        bankAccountNo,
        liffUrl,
        qrImageUrl,
      });
    }

    // Unrecognized # command
    return null;
  }
}

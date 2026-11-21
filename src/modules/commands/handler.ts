import { LedgerService } from "@/modules/ledger/service";
import { MembershipService } from "@/modules/membership/service";
import {
  createGroupBalanceFlexMessage,
  createPersonalBalanceFlexMessage,
  createHelpFlexMessage,
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

    // Unrecognized # command
    return null;
  }
}

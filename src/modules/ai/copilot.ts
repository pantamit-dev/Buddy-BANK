import { createAdminClient } from "@/integrations/supabase/server";
import { AiBusinessTools } from "./tools";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CopilotChatResponse {
  replyText: string;
  chart?: {
    type: "bar" | "pie" | "line";
    title: string;
    labels: string[];
    values: number[];
  };
  suggestions?: string[];
  insights?: {
    estimatedDaysRemaining?: number | null;
    estimatedCompletionDate?: string | null;
    averageDepositAmount?: number;
  };
}

export class MiniAppCopilotService {
  private tools: AiBusinessTools;

  constructor(private supabase = createAdminClient()) {
    this.tools = new AiBusinessTools(this.supabase);
  }

  /**
   * Multi-turn conversational copilot for the LINE Mini App
   */
  async chat(params: {
    groupId: string;
    userId?: string;
    messages: ChatMessage[];
  }): Promise<CopilotChatResponse> {
    const { groupId, messages } = params;
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    const query = lastUserMessage?.content.toLowerCase() || "";

    const progress = await this.tools.getGroupProgress(groupId);
    const balance = await this.tools.getGroupBalance(groupId);
    const unpaid = await this.tools.getUnpaidMembers(groupId);

    // Calculate deposits history and average
    const { data: deposits } = await this.supabase
      .from("deposits")
      .select("detected_amount, transfer_date, created_at, group_members(profiles(display_name))")
      .eq("group_id", groupId)
      .eq("status", "verified");

    const validDeposits = (deposits || []).filter((d) => Number(d.detected_amount) > 0);
    const totalAmount = validDeposits.reduce((acc, d) => acc + Number(d.detected_amount), 0);
    const avgDeposit = validDeposits.length > 0 ? Math.round(totalAmount / validDeposits.length) : 0;

    // Estimate completion date
    let estimatedDaysRemaining: number | null = null;
    let estimatedCompletionDate: string | null = null;
    const remainingToTarget = Math.max(0, progress.targetAmount - progress.currentBalance);

    if (remainingToTarget > 0 && validDeposits.length >= 2) {
      // Calculate daily deposit rate
      const firstDate = new Date(validDeposits[0].created_at).getTime();
      const lastDate = new Date(validDeposits[validDeposits.length - 1].created_at).getTime();
      const spanDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
      const dailyRate = totalAmount / spanDays;

      if (dailyRate > 0) {
        estimatedDaysRemaining = Math.ceil(remainingToTarget / dailyRate);
        const compDate = new Date(Date.now() + estimatedDaysRemaining * 24 * 60 * 60 * 1000);
        estimatedCompletionDate = compDate.toISOString().split("T")[0];
      }
    }

    // Member contribution distribution for charts
    const memberTotals: Record<string, number> = {};
    for (const d of validDeposits) {
      const name = (d as any).group_members?.profiles?.display_name || "สมาชิก";
      memberTotals[name] = (memberTotals[name] || 0) + Number(d.detected_amount);
    }

    const memberLabels = Object.keys(memberTotals);
    const memberValues = Object.values(memberTotals);

    // 1. Chart or visual inquiries
    if (query.includes("กราฟ") || query.includes("แผนภูมิ") || query.includes("สัดส่วน") || query.includes("chart")) {
      return {
        replyText:
          `📊 นี่คือกราฟสรุปยอดเงินสมทบของสมาชิกแต่ละท่านในกลุ่ม "${progress.groupName}" ครับ ` +
          `ปัจจุบันมียอดสะสมรวม ฿${progress.currentBalance.toLocaleString()} จากเป้าหมาย ฿${progress.targetAmount.toLocaleString()} (${progress.progressPercentage}%)`,
        chart: {
          type: "bar",
          title: "ยอดสมทบแยกตามสมาชิก (THB)",
          labels: memberLabels.length > 0 ? memberLabels : ["ยังไม่มีข้อมูล"],
          values: memberValues.length > 0 ? memberValues : [0],
        },
        suggestions: ["คาดการณ์วันที่จะถึงเป้า", "ใครยังไม่ได้โอนบ้าง", "สรุปบัญชีเดือนนี้"],
      };
    }

    // 2. Goal forecast inquiries
    if (query.includes("คาดการณ์") || query.includes("เสร็จเมื่อไหร่") || query.includes("ถึงเป้า") || query.includes("forecast") || query.includes("แนวโน้ม")) {
      if (progress.isGoalReached) {
        return {
          replyText: `🎉 กลุ่ม "${progress.groupName}" ได้บรรลุเป้าหมายการออมเงิน ฿${progress.targetAmount.toLocaleString()} ครบ 100% เรียบร้อยแล้วครับ!`,
          suggestions: ["ดูกราฟยอดสมทบ", "ส่งออกรายงาน Excel"],
        };
      }

      if (estimatedDaysRemaining !== null && estimatedCompletionDate !== null) {
        return {
          replyText:
            `📈 จากอัตราการโอนเฉลี่ยวันละ ฿${Math.round(totalAmount / Math.max(1, (Date.now() - new Date(validDeposits[0].created_at).getTime()) / 86400000)).toLocaleString()} ` +
            `คาดว่ากลุ่มจะเก็บเงินครบตามเป้าหมาย ฿${progress.targetAmount.toLocaleString()} ภายในประมาณ **${estimatedDaysRemaining} วัน** (ราววันที่ **${estimatedCompletionDate}**) ครับ!`,
          insights: {
            estimatedDaysRemaining,
            estimatedCompletionDate,
            averageDepositAmount: avgDeposit,
          },
          suggestions: ["ดูกราฟยอดสมทบ", "ใครยังไม่ได้โอนบ้าง"],
        };
      } else {
        return {
          replyText:
            `⏳ ปัจจุบันยังขาดเงินอีก ฿${remainingToTarget.toLocaleString()} จึงจะถึงเป้าหมาย ฿${progress.targetAmount.toLocaleString()} ` +
            `เมื่อสมาชิกเริ่มโอนเงินต่อเนื่อง ผมจะคำนวณวันที่จะถึงเป้าให้อัตโนมัติครับ`,
          suggestions: ["ใครยังค้างจ่ายบ้าง", "ดูกราฟยอดสมทบ"],
        };
      }
    }

    // 3. Unpaid or status inquiries
    if (query.includes("ใครยังไม่จ่าย") || query.includes("ค้าง") || query.includes("ตามเงิน")) {
      if (unpaid.unpaidCount === 0) {
        return {
          replyText: `✅ ยอดเยี่ยมมากครับ! สมาชิกทุกคน (${unpaid.paidCount} ท่าน) โอนเงินเข้ากองกลางครบทั้งหมดแล้ว`,
          suggestions: ["ดูกราฟยอดสมทบ", "ส่งออกรายงาน"],
        };
      } else {
        const names = unpaid.unpaidMembers.map((m) => m.displayName).join(", ");
        return {
          replyText: `⚠️ ขณะนี้มีสมาชิกที่ยังไม่ได้โอนเงินจำนวน ${unpaid.unpaidCount} ท่าน ได้แก่: **${names}** ครับ`,
          suggestions: ["คาดการณ์วันที่จะถึงเป้า", "ดูกราฟยอดสมทบ"],
        };
      }
    }

    // Default conversational reply
    return {
      replyText:
        `สวัสดีครับ! ผมคือผู้ช่วยวิเคราะห์การเงินอัจฉริยะ (Bank Buddy Copilot)\n` +
        `ขณะนี้กลุ่ม "${progress.groupName}" มียอดสะสม ฿${progress.currentBalance.toLocaleString()} / ฿${progress.targetAmount.toLocaleString()} (${progress.progressPercentage}%)\n` +
        `คุณสามารถถามผมเกี่ยวกับ:\n` +
        `• "ขอดูกราฟยอดสมทบของสมาชิก"\n` +
        `• "คาดการณ์วันที่จะถึงเป้าหมาย"\n` +
        `• "ใครยังไม่ได้โอนเงินบ้าง"`,
      chart: {
        type: "pie",
        title: "สัดส่วนความคืบหน้าเป้าหมาย",
        labels: ["ยอดเงินที่เก็บได้แล้ว", "ยอดที่ยังขาด"],
        values: [progress.currentBalance, Math.max(0, progress.targetAmount - progress.currentBalance)],
      },
      suggestions: ["ดูกราฟยอดสมทบ", "คาดการณ์วันที่จะถึงเป้า", "ใครยังค้างจ่ายบ้าง"],
      insights: {
        averageDepositAmount: avgDeposit,
        estimatedDaysRemaining,
        estimatedCompletionDate,
      },
    };
  }
}

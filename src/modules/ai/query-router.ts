import { createAdminClient } from "@/integrations/supabase/server";
import { AiBusinessTools } from "./tools";
import { sanitizeGroupResponse } from "./privacy-filter";

export interface BotQueryIntent {
  intent: "progress" | "unpaid" | "transactions" | "general_help";
  confidence: number;
}

export class HybridAiQueryRouter {
  private tools: AiBusinessTools;

  constructor(private supabase = createAdminClient()) {
    this.tools = new AiBusinessTools(this.supabase);
  }

  /**
   * Checks whether the incoming message is an On-Demand mention directed to the bot
   */
  static isBotMention(text: string): boolean {
    if (!text) return false;
    const clean = text.trim();
    return (
      clean.startsWith("@") ||
      clean.includes("@MoneyPoolBot") ||
      clean.includes("@BankBuddy") ||
      clean.includes("@Bot") ||
      clean.includes("@bot") ||
      clean.startsWith("บอท") ||
      clean.startsWith("น้องบอท")
    );
  }

  /**
   * Extracts clean query text stripped of bot mention prefix
   */
  static extractQueryText(text: string): string {
    return text
      .replace(/^@[\w\d_-]+\s*/i, "")
      .replace(/^@MoneyPoolBot\s*/i, "")
      .replace(/^@BankBuddy\s*/i, "")
      .replace(/^@Bot\s*/i, "")
      .replace(/^@bot\s*/i, "")
      .replace(/^บอท\s*/, "")
      .replace(/^น้องบอท\s*/, "")
      .trim();
  }

  /**
   * Classifies user intent from natural language query
   */
  classifyIntent(query: string): BotQueryIntent {
    const q = query.toLowerCase();

    if (
      q.includes("ใครยังไม่จ่าย") ||
      q.includes("ใครค้าง") ||
      q.includes("ยังไม่โอน") ||
      q.includes("ตามเงิน") ||
      q.includes("ทวงเงิน") ||
      q.includes("คนไม่จ่าย") ||
      q.includes("ค้างจ่าย")
    ) {
      return { intent: "unpaid", confidence: 0.95 };
    }

    if (
      q.includes("ยอด") ||
      q.includes("ความคืบหน้า") ||
      q.includes("ถึงไหน") ||
      q.includes("เป้าหมาย") ||
      q.includes("เหลืออีกเท่าไหร่") ||
      q.includes("ขาดอีก") ||
      q.includes("เงินรวม") ||
      q.includes("กองกลางมีเท่าไหร่")
    ) {
      return { intent: "progress", confidence: 0.9 };
    }

    if (
      q.includes("รายการ") ||
      q.includes("ประวัติ") ||
      q.includes("ล่าสุด") ||
      q.includes("ใครโอนมา") ||
      q.includes("สลิปล่าสุด")
    ) {
      return { intent: "transactions", confidence: 0.9 };
    }

    return { intent: "general_help", confidence: 0.7 };
  }

  /**
   * Routes group query to strictly verified business tools with Group Privacy filter
   */
  async handleGroupQuery(groupId: string, rawText: string): Promise<string> {
    const query = HybridAiQueryRouter.extractQueryText(rawText);
    const { intent } = this.classifyIntent(query);

    let response = "";

    switch (intent) {
      case "progress": {
        const p = await this.tools.getGroupProgress(groupId);
        response =
          `🤖 [น้องบอทรายงานความคืบหน้า]\n` +
          `📌 กลุ่ม: ${p.groupName}\n` +
          `💰 ยอดคงเหลือปัจจุบัน: ฿${p.currentBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n` +
          `🎯 เป้าหมาย: ฿${p.targetAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n` +
          `📈 ความคืบหน้า: ${p.progressPercentage}%\n` +
          (p.isGoalReached
            ? `🎉 ยินดีด้วยครับ! กองกลางถึงเป้าหมายแล้ว`
            : `⏳ ขาดอีกเพียง: ฿${p.remainingAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`);
        break;
      }

      case "unpaid": {
        const u = await this.tools.getUnpaidMembers(groupId);
        if (u.unpaidCount === 0) {
          response = `🤖 สมาชิกทุกคน (${u.paidCount} ท่าน) โอนเงินเข้ากองกลางครบเรียบร้อยแล้วครับ! 🎉`;
        } else {
          const names = u.unpaidMembers.map((m) => `• ${m.displayName}`).join("\n");
          response =
            `🤖 [สถานะการสมทบเงินกองกลาง]\n` +
            `✅ ร่วมสมทบแล้ว: ${u.paidCount} ท่าน\n` +
            `⏳ ยังไม่ได้ส่งสลิป: ${u.unpaidCount} ท่าน\n\n` +
            `รายชื่อที่ยังรอ:\n${names}\n\n` +
            `👉 ส่งรูปสลิปเข้ามาในกลุ่มได้เลย น้องบอทจะตรวจให้อัตโนมัติครับ`;
        }
        break;
      }

      case "transactions": {
        const txs = await this.tools.getRecentTransactions(groupId, 5);
        if (txs.length === 0) {
          response = "🤖 ยังไม่มีรายการโอนเงินที่บันทึกในกลุ่มนี้ครับ";
        } else {
          const lines = txs.map(
            (t) =>
              `• ${t.type === "credit" ? "📥" : "📤"} ฿${t.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} (${t.member})`
          );
          response = `🤖 [5 รายการบัญชีล่าสุด]\n` + lines.join("\n");
        }
        break;
      }

      case "general_help":
      default: {
        response =
          `🤖 สวัสดีครับ! ผมเป็นผู้ช่วยดูแลกองกลาง Bank Buddy\n` +
          `สามารถสอบถามผมได้ เช่น:\n` +
          `• "ยอดถึงไหนแล้ว" เพื่อดูความคืบหน้า\n` +
          `• "ใครยังไม่จ่ายบ้าง" เพื่อดูรายชื่อ\n` +
          `• "รายการล่าสุด" เพื่อดูประวัติการโอนเงิน\n` +
          `หรือส่งรูปสลิปเข้ามาในกลุ่มได้ตลอดเวลาครับ!`;
        break;
      }
    }

    return sanitizeGroupResponse(response);
  }
}

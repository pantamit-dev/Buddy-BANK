import type { messagingApi } from "@line/bot-sdk";
import { formatCurrency, formatThaiDate } from "@/lib/utils";

/**
 * Creates the Welcome & Onboarding Flex Message when the bot joins or introduces itself
 */
export function createWelcomeFlexMessage(liffUrl: string): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: "ยินดีต้อนรับสู่ Money Pool (Bank Buddy)",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#059669",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "🏦 Money Pool (Bank Buddy)",
            weight: "bold",
            color: "#ffffff",
            size: "lg",
          },
          {
            type: "text",
            text: "ระบบจัดการเงินกองกลางอัตโนมัติ",
            color: "#d1fae5",
            size: "xs",
            margin: "xs",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "ยินดีต้อนรับสมาชิกทุกคน! กรุณากดลงทะเบียนเพื่อร่วมเป็นสมาชิกกองกลางและส่งสลิปโอนเงิน",
            wrap: true,
            size: "sm",
            color: "#334155",
          },
          {
            type: "separator",
            margin: "md",
          },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: "📌 คำสั่งที่ใช้งานได้ในแชท:",
                weight: "bold",
                size: "xs",
                color: "#0f172a",
              },
              {
                type: "text",
                text: "• #ยอดรวม : ดูยอดเงินกองกลางและเป้าหมาย",
                size: "xs",
                color: "#64748b",
              },
              {
                type: "text",
                text: "• #ยอดฉัน : ดูยอดเงินที่ตนเองโอนสมทบ",
                size: "xs",
                color: "#64748b",
              },
              {
                type: "text",
                text: "• #ช่วยเหลือ : ดูคำแนะนำการใช้งาน",
                size: "xs",
                color: "#64748b",
              },
            ],
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
              label: "📱 เปิดระบบกองกลาง (Mini App)",
              uri: liffUrl,
            },
          },
        ],
      },
    },
  };
}

const BANK_DISPLAY_NAMES: Record<string, string> = {
  KBank: "กสิกรไทย (KBank)",
  SCB: "ไทยพาณิชย์ (SCB)",
  KTB: "กรุงไทย (Krungthai)",
  BBL: "กรุงเทพ (Bangkok Bank)",
  BAY: "กรุงศรีอยุธยา (Krungsri)",
  TTB: "ทหารไทยธนชาต (ttb)",
  GSB: "ออมสิน (GSB)",
  PromptPay: "พร้อมเพย์ (PromptPay)",
  TrueMoney: "ทรูมันนี่ (TrueMoney)",
  BAAC: "ธ.ก.ส. (BAAC)",
  CIMB: "ซีไอเอ็มบี (CIMB)",
  UOB: "ยูโอบี (UOB)",
  KKP: "เกียรตินาคินภัทร (KKP)",
  LHBANK: "แลนด์ แอนด์ เฮ้าส์ (LH Bank)",
};

export function getBankDisplayName(bankCode?: string | null): string {
  if (!bankCode) return "ไม่ระบุ";
  return BANK_DISPLAY_NAMES[bankCode] || bankCode;
}

/**
 * Creates the Slip Intake Pending Review Card with Approve & Reject Postback Buttons
 */
export function createSlipReviewFlexMessage(params: {
  depositId: string;
  groupId: string;
  uploaderName: string;
  amount: number | null;
  transferDate?: string | null;
  bankReference?: string | null;
  bankName?: string | null;
}): messagingApi.FlexMessage {
  const { depositId, groupId, uploaderName, amount, transferDate, bankReference, bankName } = params;

  return {
    type: "flex",
    altText: `แจ้งเตือนสลิปใหม่: ${formatCurrency(amount)} จาก ${uploaderName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0284c7",
        paddingAll: "15px",
        contents: [
          {
            type: "text",
            text: "🧾 ตรวจพบสลิปโอนเงินใหม่",
            weight: "bold",
            color: "#ffffff",
            size: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ผู้ส่งสลิป", size: "sm", color: "#64748b", flex: 2 },
              { type: "text", text: uploaderName, size: "sm", weight: "bold", color: "#0f172a", flex: 3, wrap: true },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ยอดเงินที่ตรวจพบ", size: "sm", color: "#64748b", flex: 2 },
              {
                type: "text",
                text: amount !== null ? formatCurrency(amount) : "รอการระบุ",
                size: "md",
                weight: "bold",
                color: "#059669",
                flex: 3,
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ธนาคาร", size: "xs", color: "#64748b", flex: 2 },
              {
                type: "text",
                text: getBankDisplayName(bankName),
                size: "xs",
                weight: "bold",
                color: "#1e293b",
                flex: 3,
                wrap: true,
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "วันที่/เวลา", size: "xs", color: "#64748b", flex: 2 },
              {
                type: "text",
                text: transferDate
                  ? transferDate.includes("T")
                    ? formatThaiDate(transferDate)
                    : transferDate
                  : "-",
                size: "xs",
                color: "#334155",
                flex: 3,
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "รหัสอ้างอิง", size: "xs", color: "#64748b", flex: 2 },
              { type: "text", text: bankReference || "ไม่ระบุ", size: "xs", color: "#334155", flex: 3 },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "md",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#059669",
            height: "sm",
            action: {
              type: "postback",
              label: "✅ อนุมัติ",
              data: `action=approve&depositId=${depositId}&groupId=${groupId}`,
              displayText: `อนุมัติรายการ ${formatCurrency(amount)}`,
            },
          },
          {
            type: "button",
            style: "secondary",
            color: "#ef4444",
            height: "sm",
            action: {
              type: "postback",
              label: "❌ ปฏิเสธ",
              data: `action=reject&depositId=${depositId}&groupId=${groupId}`,
              displayText: "ปฏิเสธสลิปนี้",
            },
          },
        ],
      },
    },
  };
}

/**
 * Creates confirmation card when a deposit is verified and recorded to ledger
 */
export function createDepositApprovedFlexMessage(params: {
  amount: number;
  totalBalance: number;
  reviewerName: string;
}): messagingApi.FlexMessage {
  const { amount, totalBalance, reviewerName } = params;

  return {
    type: "flex",
    altText: `✅ ยืนยันยอดเงิน ${formatCurrency(amount)} สำเร็จ`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#059669",
        paddingAll: "15px",
        contents: [
          {
            type: "text",
            text: "✅ บันทึกยอดเงินเข้ากองกลางสำเร็จ",
            weight: "bold",
            color: "#ffffff",
            size: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "จำนวนเงินที่เข้า:", size: "sm", color: "#64748b" },
              { type: "text", text: formatCurrency(amount), size: "md", weight: "bold", color: "#059669", align: "end" },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ยอดเงินกองกลางรวม:", size: "sm", color: "#64748b" },
              { type: "text", text: formatCurrency(totalBalance), size: "sm", weight: "bold", color: "#0f172a", align: "end" },
            ],
          },
          {
            type: "separator",
            margin: "sm",
          },
          {
            type: "text",
            text: `อนุมัติโดย: ${reviewerName}`,
            size: "xs",
            color: "#94a3b8",
            align: "end",
            margin: "sm",
          },
        ],
      },
    },
  };
}

/**
 * Creates alert for duplicate slip
 */
export function createDuplicateSlipFlexMessage(bankReference: string): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: "⚠️ สลิปซ้ำ รายการนี้เคยบันทึกแล้ว",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "⚠️ ตรวจพบสลิปซ้ำ",
            weight: "bold",
            color: "#e11d48",
            size: "md",
          },
          {
            type: "text",
            text: `รหัสอ้างอิง ${bankReference} เคยถูกบันทึกหรืออยู่ระหว่างตรวจสอบในกองกลางนี้แล้ว`,
            wrap: true,
            size: "sm",
            color: "#475569",
          },
        ],
      },
    },
  };
}

/**
 * Creates Group Balance Flex Message for `#ยอดรวม`
 */
export function createGroupBalanceFlexMessage(params: {
  groupName: string;
  totalBalance: number;
  targetAmount: number;
  percentage: number;
  memberCount: number;
  liffUrl?: string;
}): messagingApi.FlexMessage {
  const { groupName, totalBalance, targetAmount, percentage, memberCount, liffUrl } = params;
  const clampedPercent = Math.min(Math.max(percentage, 0), 100);

  return {
    type: "flex",
    altText: `สรุปยอดกองกลาง: ${formatCurrency(totalBalance)} (${clampedPercent.toFixed(1)}%)`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0f172a",
        paddingAll: "15px",
        contents: [
          {
            type: "text",
            text: "📊 สรุปยอดเงินกองกลาง",
            weight: "bold",
            color: "#ffffff",
            size: "md",
          },
          {
            type: "text",
            text: groupName,
            color: "#94a3b8",
            size: "xs",
            margin: "xs",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "ยอดสะสมปัจจุบัน", size: "xs", color: "#64748b" },
              {
                type: "text",
                text: formatCurrency(totalBalance),
                size: "xl",
                weight: "bold",
                color: "#059669",
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: `เป้าหมาย: ${formatCurrency(targetAmount)}`, size: "xs", color: "#64748b" },
              { type: "text", text: `${percentage.toFixed(1)}%`, size: "xs", weight: "bold", color: "#0f172a", align: "end" },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#e2e8f0",
            height: "8px",
            cornerRadius: "4px",
            contents: [
              {
                type: "box",
                layout: "vertical",
                backgroundColor: "#10b981",
                height: "8px",
                width: `${clampedPercent}%`,
                cornerRadius: "4px",
                contents: [],
              },
            ],
          },
          {
            type: "text",
            text: `สมาชิกในกลุ่ม: ${memberCount} คน`,
            size: "xs",
            color: "#64748b",
          },
        ],
      },
      footer: liffUrl
        ? {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "uri",
                  label: "🔍 ดูรายละเอียดใน Mini App",
                  uri: liffUrl,
                },
              },
            ],
          }
        : undefined,
    },
  };
}

/**
 * Creates Personal Balance Flex Message for `#ยอดฉัน`
 */
export function createPersonalBalanceFlexMessage(params: {
  memberName: string;
  personalTotal: number;
  groupTotal: number;
  percentageOfPool: number;
}): messagingApi.FlexMessage {
  const { memberName, personalTotal, groupTotal, percentageOfPool } = params;

  return {
    type: "flex",
    altText: `ยอดสมทบของคุณ: ${formatCurrency(personalTotal)}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "👤 ยอดสมทบของคุณ",
            weight: "bold",
            color: "#0f172a",
            size: "md",
          },
          {
            type: "text",
            text: memberName,
            size: "xs",
            color: "#64748b",
          },
          {
            type: "separator",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ที่คุณโอนแล้ว:", size: "sm", color: "#64748b" },
              {
                type: "text",
                text: formatCurrency(personalTotal),
                size: "md",
                weight: "bold",
                color: "#059669",
                align: "end",
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "สัดส่วนในกองกลาง:", size: "xs", color: "#64748b" },
              {
                type: "text",
                text: `${percentageOfPool.toFixed(1)}% (จาก ${formatCurrency(groupTotal)})`,
                size: "xs",
                color: "#334155",
                align: "end",
              },
            ],
          },
        ],
      },
    },
  };
}

/**
 * Creates Help Flex Message for `#ช่วยเหลือ`
 */
export function createHelpFlexMessage(liffUrl: string): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: "คำแนะนำการใช้งาน Money Pool",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#334155",
        paddingAll: "15px",
        contents: [
          {
            type: "text",
            text: "💡 คำแนะนำการใช้งาน Money Pool",
            weight: "bold",
            color: "#ffffff",
            size: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "1. โอนเงินเข้าบัญชีกองกลาง แล้วส่งรูปสลิปเข้ามาในกลุ่มนี้",
            size: "xs",
            wrap: true,
            color: "#1e293b",
          },
          {
            type: "text",
            text: "2. ระบบจะอ่านสลิปและส่งการ์ดให้เหรัญญิก/เจ้าของกลุ่มกดอนุมัติ",
            size: "xs",
            wrap: true,
            color: "#1e293b",
          },
          {
            type: "text",
            text: "3. พิมพ์คำสั่งเช็คยอดได้ตลอด 24 ชม.:",
            size: "xs",
            weight: "bold",
            color: "#0f172a",
            margin: "sm",
          },
          {
            type: "text",
            text: "• #ยอดรวม หรือ #สรุป : ตรวจสอบยอดรวมและเป้าหมาย",
            size: "xs",
            color: "#475569",
          },
          {
            type: "text",
            text: "• #ยอดฉัน : ดูยอดเงินสะสมส่วนตัว",
            size: "xs",
            color: "#475569",
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
              label: "เปิดหน้าต่างระบบ Mini App",
              uri: liffUrl,
            },
          },
        ],
      },
    },
  };
}

/**
 * Creates Flex Message notifying a user that registration or approval is required before submitting slips
 */
export function createMembershipRequiredFlexMessage(
  liffUrl: string,
  reason: "NOT_REGISTERED" | "PENDING_APPROVAL"
): messagingApi.FlexMessage {
  const isPending = reason === "PENDING_APPROVAL";
  const title = isPending ? "⏳ บัญชีอยู่ระหว่างรอการอนุมัติ" : "⚠️ กรุณาลงทะเบียนก่อนส่งสลิป";
  const headerColor = isPending ? "#d97706" : "#e11d48";
  const bodyText = isPending
    ? "การสมัครสมาชิกของคุณอยู่ระหว่างรอเจ้าของกลุ่มตรวจสอบและอนุมัติ เมื่อได้รับการอนุมัติแล้วจะสามารถส่งสลิปโอนเงินเข้ากองกลางได้"
    : "คุณยังไม่ได้ลงทะเบียนเข้าร่วมกองกลางนี้ กรุณากดปุ่มด้านล่างเพื่อเปิด Mini App และลงทะเบียนสมาชิกก่อนส่งสลิปโอนเงิน";
  const buttonLabel = isPending ? "📱 ตรวจสอบสถานะใน Mini App" : "📱 ลงทะเบียนผ่าน Mini App";

  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerColor,
        paddingAll: "15px",
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            color: "#ffffff",
            size: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: bodyText,
            wrap: true,
            size: "sm",
            color: "#334155",
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
            color: headerColor,
            action: {
              type: "uri",
              label: buttonLabel,
              uri: liffUrl,
            },
          },
        ],
      },
    },
  };
}

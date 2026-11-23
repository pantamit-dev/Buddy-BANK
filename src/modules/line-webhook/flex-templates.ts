import type { messagingApi } from "@line/bot-sdk";
import { formatCurrency, formatThaiDate } from "@/lib/utils";

/**
 * Creates the Welcome & Onboarding Flex Message when the bot joins or introduces itself
 */
export function createWelcomeFlexMessage(liffUrl: string): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: "ยินดีต้อนรับสู่ Money Pool (Bank Buddy) — ระบบจัดการเงินกองกลาง",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#087963",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "🏦 Bank Buddy (เพื่อนพึ่งพายามยาก)",
            weight: "bold",
            color: "#ffffff",
            size: "lg",
          },
          {
            type: "text",
            text: "ระบบจัดการเงินกองกลางอัตโนมัติ & บันทึกสลิป",
            color: "#E5F4EE",
            size: "xs",
            margin: "xs",
            weight: "bold",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "ยินดีต้อนรับสมาชิกทุกคน! 👋",
            wrap: true,
            size: "md",
            weight: "bold",
            color: "#0f172a",
          },
          {
            type: "text",
            text: "ระบบพร้อมช่วยบันทึกสลิป ตรวจสอบยอดเงิน และแสดงรายงานแบบโปร่งใส กรุณายืนยันบัญชีเพื่อเริ่มต้นใช้งาน",
            wrap: true,
            size: "xs",
            color: "#475569",
          },
          {
            type: "separator",
            margin: "md",
            color: "#e2e8f0",
          },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "📖 คู่มือเริ่มต้นใช้งาน (Quick Guide):",
                weight: "bold",
                size: "sm",
                color: "#087963",
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "1️⃣", size: "sm", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "text",
                        text: "ยืนยันบัญชีผู้ใช้",
                        weight: "bold",
                        size: "xs",
                        color: "#0f172a",
                      },
                      {
                        type: "text",
                        text: "กดปุ่ม 'เปิด Mini App ยืนยันบัญชี' ด้านล่างเพื่อผูกบัญชีและตั้งชื่อสมาชิก",
                        size: "xxs",
                        color: "#64748b",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "2️⃣", size: "sm", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "text",
                        text: "ส่งสลิปโอนเงินเข้ากลุ่ม",
                        weight: "bold",
                        size: "xs",
                        color: "#0f172a",
                      },
                      {
                        type: "text",
                        text: "เมื่อโอนเงินเข้ากองกลาง ส่งรูปสลิปลงในแชท AI OCR จะอ่านยอดเงินและส่งให้เหรัญญิกบันทึก",
                        size: "xxs",
                        color: "#64748b",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "3️⃣", size: "sm", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "text",
                        text: "คำสั่งด่วนเช็คยอดเงิน",
                        weight: "bold",
                        size: "xs",
                        color: "#0f172a",
                      },
                      {
                        type: "text",
                        text: "• #ยอดรวม : เช็คยอดเงินกองกลางและเป้าหมาย\n• #ยอดฉัน : เช็คยอดเงินสะสมของตนเอง\n• #ช่วยเหลือ : ดูคำแนะนำและคำสั่งทั้งหมด",
                        size: "xxs",
                        color: "#64748b",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "4️⃣", size: "sm", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "text",
                        text: "AI ผู้ช่วยอัจฉริยะ",
                        weight: "bold",
                        size: "xs",
                        color: "#0f172a",
                      },
                      {
                        type: "text",
                        text: "พิมพ์ถามหรือแท็ก @BankBuddy เพื่อสอบถามยอดเงินและข้อมูลกองกลางได้ตลอด 24 ชม.",
                        size: "xxs",
                        color: "#64748b",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        backgroundColor: "#f8fafc",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#087963",
            height: "sm",
            action: {
              type: "uri",
              label: "🚀 เปิด Mini App ยืนยันบัญชี",
              uri: liffUrl,
            },
          },
          {
            type: "text",
            text: "🛡️ ปลอดภัย • โปร่งใส • ตรวจสอบได้ทุกธุรกรรม",
            size: "xxs",
            color: "#94a3b8",
            align: "center",
            margin: "xs",
          },
        ],
      },
    },
  };
}

/**
 * Creates the New Member Welcome Flex Message with Quick Guide and Mini App Verification Button
 * Triggered on LINE 'memberJoined' webhook event or when new members are invited
 */
export function createNewMemberWelcomeFlexMessage(params: {
  liffUrl: string;
  memberNames?: string[];
  groupName?: string;
}): messagingApi.FlexMessage {
  const { liffUrl, memberNames = [], groupName } = params;

  const namesText =
    memberNames.length > 0
      ? memberNames.length === 1
        ? `คุณ ${memberNames[0]}`
        : `คุณ ${memberNames.slice(0, 3).join(", ")}${memberNames.length > 3 ? " และเพื่อนๆ" : ""}`
      : "สมาชิกใหม่ทุกท่าน";

  const altGreeting = `ยินดีต้อนรับ ${namesText} สู่ ${groupName || "กลุ่มกองกลาง (Bank Buddy)"} — คู่มือเบื้องต้น & ยืนยันบัญชี`;

  return {
    type: "flex",
    altText: altGreeting,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#087963",
        paddingAll: "20px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "🎉 ยินดีต้อนรับสมาชิกใหม่!",
                weight: "bold",
                color: "#ffffff",
                size: "lg",
                flex: 1,
              },
            ],
          },
          {
            type: "text",
            text: groupName ? `กลุ่ม: ${groupName}` : "Bank Buddy — เพื่อนพึ่งพายามยาก",
            color: "#E5F4EE",
            size: "xs",
            margin: "xs",
            weight: "bold",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: `ยินดีต้อนรับ ${namesText} สู่กลุ่มกองกลาง 👋`,
            wrap: true,
            size: "md",
            weight: "bold",
            color: "#0f172a",
          },
          {
            type: "text",
            text: "เพื่อความถูกต้อง โปร่งใส และปลอดภัยของเงินกองกลาง กรุณากดปุ่มด้านล่างเพื่อเปิด LINE Mini App และยืนยันบัญชีก่อนเริ่มใช้งานครับ",
            wrap: true,
            size: "xs",
            color: "#475569",
          },
          {
            type: "separator",
            margin: "md",
            color: "#e2e8f0",
          },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "📖 คู่มือเริ่มต้นใช้งาน (Quick Guide):",
                weight: "bold",
                size: "sm",
                color: "#087963",
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "1️⃣", size: "sm", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "text",
                        text: "ยืนยันบัญชีผู้ใช้",
                        weight: "bold",
                        size: "xs",
                        color: "#0f172a",
                      },
                      {
                        type: "text",
                        text: "กดปุ่ม 'เปิด Mini App ยืนยันบัญชี' ด้านล่างเพื่อผูกบัญชีและตั้งชื่อสมาชิก",
                        size: "xxs",
                        color: "#64748b",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "2️⃣", size: "sm", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "text",
                        text: "ส่งสลิปโอนเงินเข้าแชท",
                        weight: "bold",
                        size: "xs",
                        color: "#0f172a",
                      },
                      {
                        type: "text",
                        text: "เมื่อโอนเงินเข้ากองกลาง ส่งรูปสลิปลงในแชทกลุ่มได้ทันที AI OCR จะช่วยอ่านยอดเงินและส่งให้เหรัญญิกบันทึก",
                        size: "xxs",
                        color: "#64748b",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "3️⃣", size: "sm", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "text",
                        text: "คำสั่งด่วนเช็คยอดเงิน",
                        weight: "bold",
                        size: "xs",
                        color: "#0f172a",
                      },
                      {
                        type: "text",
                        text: "• #ยอดรวม : เช็คยอดเงินกองกลางและเป้าหมาย\n• #ยอดฉัน : เช็คยอดเงินสะสมของตนเอง\n• #ช่วยเหลือ : ดูคำแนะนำและคำสั่งทั้งหมด",
                        size: "xxs",
                        color: "#64748b",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "4️⃣", size: "sm", flex: 0 },
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "text",
                        text: "AI ผู้ช่วยอัจฉริยะ",
                        weight: "bold",
                        size: "xs",
                        color: "#0f172a",
                      },
                      {
                        type: "text",
                        text: "พิมพ์ถามหรือแท็ก @BankBuddy ในกลุ่มเพื่อสอบถามยอดเงินและข้อมูลกองกลางได้ตลอด 24 ชม.",
                        size: "xxs",
                        color: "#64748b",
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        backgroundColor: "#f8fafc",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#087963",
            height: "sm",
            action: {
              type: "uri",
              label: "🚀 เปิด Mini App ยืนยันบัญชี",
              uri: liffUrl,
            },
          },
          {
            type: "text",
            text: "🛡️ ปลอดภัย • โปร่งใส • ตรวจสอบได้ทุกธุรกรรม",
            size: "xxs",
            color: "#94a3b8",
            align: "center",
            margin: "xs",
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
        backgroundColor: "#f59e0b",
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
              { type: "text", text: uploaderName, size: "sm", weight: "bold", color: "#0f172a", flex: 3, wrap: true, align: "end" },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "จำนวนเงิน", size: "sm", color: "#64748b", flex: 2 },
              {
                type: "text",
                text: amount !== null ? formatCurrency(amount) : "รอการระบุ",
                size: "md",
                weight: "bold",
                color: "#059669",
                flex: 3,
                align: "end",
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
                align: "end",
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
                align: "end",
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "รหัสอ้างอิง", size: "xs", color: "#64748b", flex: 2 },
              { type: "text", text: bankReference || "ไม่ระบุ", size: "xs", color: "#334155", flex: 3, wrap: true, align: "end" },
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
              label: "✅ บันทึก",
              data: `action=approve&depositId=${depositId}&groupId=${groupId}`,
              displayText: `บันทึกรายการ ${formatCurrency(amount)}`,
            },
          },
          {
            type: "button",
            style: "secondary",
            color: "#ef4444",
            height: "sm",
            action: {
              type: "postback",
              label: "❌ ยกเลิก",
              data: `action=reject&depositId=${depositId}&groupId=${groupId}`,
              displayText: "ยกเลิกสลิปนี้",
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
            text: `บันทึกโดย: ${reviewerName}`,
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
            spacing: "xs",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#087963",
                height: "sm",
                action: {
                  type: "message",
                  label: "👥 ดูรายชื่อสมาชิก & ยอดสมทบ",
                  text: "#รายชื่อ",
                },
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "xs",
                contents: [
                  {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    flex: 1,
                    action: {
                      type: "message",
                      label: "👤 ยอดฉัน",
                      text: "#ยอดฉัน",
                    },
                  },
                  {
                    type: "button",
                    style: "secondary",
                    height: "sm",
                    flex: 1,
                    action: {
                      type: "message",
                      label: "💸 ขอ QR",
                      text: "#qr",
                    },
                  },
                ],
              },
              {
                type: "button",
                style: "link",
                height: "sm",
                color: "#087963",
                action: {
                  type: "uri",
                  label: "🔍 ดูรายละเอียดทั้งหมดใน Mini App",
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
  role?: string;
  liffUrl?: string;
}): messagingApi.FlexMessage {
  const { memberName, personalTotal, groupTotal, percentageOfPool, role, liffUrl } = params;

  let roleText = "👤 สมาชิกทั่วไป";
  if (role === "owner") roleText = "👑 หัวหน้ากลุ่ม (Owner)";
  else if (role === "treasurer") roleText = "🛡️ เหรัญญิก (Treasurer)";
  else if (role === "viewer") roleText = "👁️ ผู้สังเกตการณ์";

  return {
    type: "flex",
    altText: `ยอดสมทบของคุณ: ${formatCurrency(personalTotal)} (${percentageOfPool.toFixed(1)}%)`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#087963",
        paddingAll: "15px",
        contents: [
          {
            type: "text",
            text: "👤 ยอดเงินสะสมส่วนตัว",
            weight: "bold",
            color: "#ffffff",
            size: "md",
          },
          {
            type: "text",
            text: `${memberName} • ${roleText}`,
            color: "#E5F4EE",
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
              { type: "text", text: "ยอดที่คุณโอนสะสมเข้ากองกลางแล้ว", size: "xs", color: "#64748b" },
              {
                type: "text",
                text: formatCurrency(personalTotal),
                size: "xl",
                weight: "bold",
                color: "#059669",
              },
            ],
          },
          {
            type: "separator",
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
                color: "#1e293b",
                weight: "bold",
                align: "end",
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            spacing: "xs",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#087963",
                height: "sm",
                flex: 1,
                action: {
                  type: "message",
                  label: "👥 ยอดเพื่อน",
                  text: "#รายชื่อ",
                },
              },
              {
                type: "button",
                style: "primary",
                color: "#0f172a",
                height: "sm",
                flex: 1,
                action: {
                  type: "message",
                  label: "💸 โอนเพิ่ม",
                  text: "#โอนเงิน",
                },
              },
            ],
          },
          ...(liffUrl
            ? [
                {
                  type: "button" as const,
                  style: "secondary" as const,
                  height: "sm" as const,
                  action: {
                    type: "uri" as const,
                    label: "📱 ประวัติสลิปของฉันใน Mini App",
                    uri: `${liffUrl}/my-deposits`,
                  },
                },
              ]
            : []),
        ],
      },
    },
  };
}

/**
 * Creates Member List Flex Message for `#รายชื่อ` / `#สมาชิก`
 */
export function createMemberListFlexMessage(params: {
  groupName: string;
  members: Array<{
    displayName: string;
    role: string;
    contributionTotal: number;
    sharePercentage: number;
    status: string;
  }>;
  totalBalance: number;
  liffUrl?: string;
}): messagingApi.FlexMessage {
  const { groupName, members, totalBalance, liffUrl } = params;

  const displayMembers = members.slice(0, 10);
  const remainingCount = members.length - displayMembers.length;

  const memberRows = displayMembers.map((m) => {
    let roleIcon = "👤";
    if (m.role === "owner") roleIcon = "👑";
    else if (m.role === "treasurer") roleIcon = "🛡️";
    else if (m.role === "viewer") roleIcon = "👁️";

    const isPending = m.status === "pending_approval";

    return {
      type: "box" as const,
      layout: "horizontal" as const,
      alignItems: "center" as const,
      spacing: "sm" as const,
      paddingTop: "4px" as const,
      paddingBottom: "4px" as const,
      contents: [
        {
          type: "text" as const,
          text: `${roleIcon} ${m.displayName}`,
          size: "xs" as const,
          weight: "bold" as const,
          color: "#1e293b" as const,
          flex: 4,
          wrap: false,
        },
        {
          type: "box" as const,
          layout: "vertical" as const,
          alignItems: "flex-end" as const,
          flex: 3,
          contents: [
            {
              type: "text" as const,
              text: isPending ? "รออนุมัติ" : formatCurrency(m.contributionTotal),
              size: "xs" as const,
              weight: "bold" as const,
              color: isPending ? "#d97706" : "#059669" as const,
              align: "end" as const,
            },
            {
              type: "text" as const,
              text: isPending ? "pending" : `${m.sharePercentage.toFixed(1)}%`,
              size: "xxs" as const,
              color: "#64748b" as const,
              align: "end" as const,
            },
          ],
        },
      ],
    };
  });

  return {
    type: "flex",
    altText: `รายชื่อสมาชิกกองกลาง (${members.length} คน): ยอดรวม ${formatCurrency(totalBalance)}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0f172a",
        paddingAll: "15px",
        contents: [
          {
            type: "text",
            text: "👥 รายชื่อสมาชิก & ยอดสะสมรายบุคคล",
            weight: "bold",
            color: "#ffffff",
            size: "md",
          },
          {
            type: "text",
            text: `${groupName} • สมาชิก ${members.length} คน • รวม ${formatCurrency(totalBalance)}`,
            color: "#94a3b8",
            size: "xs",
            margin: "xs",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "สมาชิก", size: "xxs", color: "#64748b", weight: "bold", flex: 4 },
              { type: "text", text: "ยอดสะสม / สัดส่วน", size: "xxs", color: "#64748b", weight: "bold", align: "end", flex: 3 },
            ],
          },
          {
            type: "separator",
            margin: "xs",
            color: "#e2e8f0",
          },
          ...memberRows,
          ...(remainingCount > 0
            ? [
                {
                  type: "text" as const,
                  text: `...และสมาชิกอีก ${remainingCount} คน`,
                  size: "xxs" as const,
                  color: "#64748b" as const,
                  align: "center" as const,
                  margin: "xs" as const,
                },
              ]
            : []),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: [
          ...(liffUrl
            ? [
                {
                  type: "button" as const,
                  style: "primary" as const,
                  color: "#087963" as const,
                  height: "sm" as const,
                  action: {
                    type: "uri" as const,
                    label: "📱 จัดการสมาชิกใน Mini App",
                    uri: `${liffUrl}/group-members`,
                  },
                },
              ]
            : []),
          {
            type: "box",
            layout: "horizontal",
            spacing: "xs",
            contents: [
              {
                type: "button",
                style: "secondary",
                height: "sm",
                flex: 1,
                action: {
                  type: "message",
                  label: "👤 ยอดฉัน",
                  text: "#ยอดฉัน",
                },
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
                flex: 1,
                action: {
                  type: "message",
                  label: "📊 ยอดรวม",
                  text: "#ยอดรวม",
                },
              },
            ],
          },
        ],
      },
    },
  };
}

/**
 * Creates Transaction History Flex Message for `#ประวัติ`
 */
export function createTransactionHistoryFlexMessage(params: {
  groupName: string;
  transactions: Array<{
    amount: number;
    depositorName: string;
    createdAt: string;
  }>;
  liffUrl?: string;
}): messagingApi.FlexMessage {
  const { groupName, transactions, liffUrl } = params;

  const txRows =
    transactions.length === 0
      ? [
          {
            type: "text" as const,
            text: "ยังไม่มีประวัติการโอนเงินที่บันทึกแล้ว",
            size: "xs" as const,
            color: "#64748b" as const,
            align: "center" as const,
          },
        ]
      : transactions.map((tx) => ({
          type: "box" as const,
          layout: "horizontal" as const,
          alignItems: "center" as const,
          spacing: "sm" as const,
          paddingTop: "4px" as const,
          paddingBottom: "4px" as const,
          contents: [
            {
              type: "box" as const,
              layout: "vertical" as const,
              flex: 4,
              contents: [
                {
                  type: "text" as const,
                  text: tx.depositorName,
                  size: "xs" as const,
                  weight: "bold" as const,
                  color: "#1e293b" as const,
                },
                {
                  type: "text" as const,
                  text: tx.createdAt,
                  size: "xxs" as const,
                  color: "#64748b" as const,
                },
              ],
            },
            {
              type: "text" as const,
              text: `+${formatCurrency(tx.amount)}`,
              size: "xs" as const,
              weight: "bold" as const,
              color: "#059669" as const,
              align: "end" as const,
              flex: 3,
            },
          ],
        }));

  return {
    type: "flex",
    altText: `ประวัติการโอนเงินล่าสุด - ${groupName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1e293b",
        paddingAll: "15px",
        contents: [
          {
            type: "text",
            text: "📋 ประวัติการโอนเงินล่าสุด",
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
        spacing: "xs",
        contents: [
          ...txRows,
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
                  label: "🔍 ดูประวัติทั้งหมดใน Mini App",
                  uri: `${liffUrl}/review`,
                },
              },
            ],
          }
        : undefined,
    },
  };
}

/**
 * Common Quick Reply action buttons rendered as square/rounded chips at bottom of LINE chat
 */
export function getCommonQuickReply(): messagingApi.QuickReply {
  return {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "📊 ยอดรวม",
          text: "#ยอดรวม",
        },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "👤 ยอดฉัน",
          text: "#ยอดฉัน",
        },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "👥 รายชื่อ",
          text: "#รายชื่อ",
        },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "📋 ประวัติ",
          text: "#ประวัติ",
        },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "💸 ขอ QR",
          text: "#qr",
        },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "❓ คำสั่งทั้งหมด",
          text: "#คำสั่ง",
        },
      },
    ],
  };
}

/**
 * Creates Help Flex Message for `#ช่วยเหลือ`
 */
export function createHelpFlexMessage(liffUrl: string): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: "คำแนะนำการใช้งานและรายการคำสั่ง Bank Buddy",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#087963",
        paddingAll: "15px",
        contents: [
          {
            type: "text",
            text: "💡 คำสั่งใช้งานในแชท (Chat Commands)",
            weight: "bold",
            color: "#ffffff",
            size: "md",
          },
          {
            type: "text",
            text: "พิมพ์คำสั่งด้านล่าง หรือกดปุ่มลัดด้านล่างหน้าจอได้ทันที",
            color: "#E5F4EE",
            size: "xs",
            margin: "xs",
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
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: "📊 #ยอดรวม หรือ #สรุป",
                weight: "bold",
                size: "xs",
                color: "#087963",
              },
              {
                type: "text",
                text: "ตรวจสอบยอดเงินกองกลางปัจจุบัน และความคืบหน้าเป้าหมาย",
                size: "xxs",
                color: "#64748b",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: "👤 #ยอดฉัน หรือ #ยอดผม",
                weight: "bold",
                size: "xs",
                color: "#087963",
              },
              {
                type: "text",
                text: "ดูยอดเงินสะสมส่วนตัว สัดส่วนในกองกลาง และบทบาทของคุณ",
                size: "xxs",
                color: "#64748b",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: "👥 #รายชื่อ หรือ #สมาชิก",
                weight: "bold",
                size: "xs",
                color: "#087963",
              },
              {
                type: "text",
                text: "ดูรายชื่อสมาชิกทุกคน บทบาท และยอดเงินสมทบรายบุคคล",
                size: "xxs",
                color: "#64748b",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: "📋 #ประวัติ หรือ #สลิป",
                weight: "bold",
                size: "xs",
                color: "#087963",
              },
              {
                type: "text",
                text: "ดูรายการโอนเงิน 5 รายการล่าสุดที่ได้รับการอนุมัติแล้ว",
                size: "xxs",
                color: "#64748b",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: "💸 #โอนเงิน [ยอด] หรือ #qr",
                weight: "bold",
                size: "xs",
                color: "#087963",
              },
              {
                type: "text",
                text: "สร้าง QR Code พร้อมเพย์ตามยอดที่ระบุ หรือขอเลขบัญชีกองกลาง",
                size: "xxs",
                color: "#64748b",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: "🗳️ #เบิก [ยอด] [วัตถุประสงค์]",
                weight: "bold",
                size: "xs",
                color: "#087963",
              },
              {
                type: "text",
                text: "เสนอขอเบิกเงินกองกลางพร้อมเปิดโหวตลงมติสมาชิกในแชทกลุ่ม",
                size: "xxs",
                color: "#64748b",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: "❓ #คำสั่ง หรือ #ช่วยเหลือ",
                weight: "bold",
                size: "xs",
                color: "#087963",
              },
              {
                type: "text",
                text: "แสดงคู่มือและรายการคำสั่งทั้งหมด",
                size: "xxs",
                color: "#64748b",
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#087963",
            height: "sm",
            action: {
              type: "uri",
              label: "📱 เปิดหน้าต่างระบบ Mini App",
              uri: liffUrl,
            },
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "xs",
            contents: [
              {
                type: "button",
                style: "secondary",
                height: "sm",
                flex: 1,
                action: {
                  type: "message",
                  label: "📊 ยอดรวม",
                  text: "#ยอดรวม",
                },
              },
              {
                type: "button",
                style: "secondary",
                height: "sm",
                flex: 1,
                action: {
                  type: "message",
                  label: "👥 รายชื่อ",
                  text: "#รายชื่อ",
                },
              },
            ],
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

/**
 * Creates PromptPay QR & Transfer Flex Message for `#โอนเงิน` or `#qr`
 */
export function createPromptPayFlexMessage(params: {
  groupName: string;
  amount?: number | null;
  target: string;
  accountName: string;
  bankName: string;
  bankAccountNo: string;
  liffUrl: string;
  qrImageUrl?: string;
}): messagingApi.FlexMessage {
  const {
    groupName,
    amount,
    target,
    accountName,
    bankName,
    bankAccountNo,
    liffUrl,
    qrImageUrl,
  } = params;

  const hasAmount = typeof amount === "number" && amount > 0;
  const amountDisplay = hasAmount ? formatCurrency(amount) : "ตามความประสงค์";
  const altText = hasAmount
    ? `💸 โอนเงินเข้ากองกลาง ${formatCurrency(amount)} (PromptPay / บัญชี)`
    : "💸 โอนเงินเข้ากองกลาง (PromptPay / บัญชี)";

  const bubbleContents: messagingApi.FlexBubble = {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#059669",
      paddingAll: "14px",
      contents: [
        {
          type: "text",
          text: "💸 โอนเงินเข้ากองกลาง",
          weight: "bold",
          color: "#ffffff",
          size: "md",
        },
        {
          type: "text",
          text: groupName,
          color: "#d1fae5",
          size: "xxs",
          margin: "xs",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "14px",
      contents: [
        // Amount Banner
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#f0fdf4",
          borderColor: "#bbf7d0",
          borderWidth: "1px",
          cornerRadius: "12px",
          paddingAll: "12px",
          alignItems: "center",
          contents: [
            {
              type: "text",
              text: "ยอดเงินที่ต้องโอน",
              size: "xxs",
              color: "#166534",
              weight: "bold",
            },
            {
              type: "text",
              text: amountDisplay,
              size: "xl",
              weight: "bold",
              color: "#059669",
              margin: "xs",
            },
            {
              type: "text",
              text: hasAmount
                ? "✨ สแกน QR แล้วยอดเงินจะขึ้นอัตโนมัติ"
                : "ระบุยอดเงินที่ต้องการฝากในแอปธนาคาร",
              size: "xxs",
              color: "#4ade80",
              margin: "xs",
            },
          ],
        },
        // Account Details Box
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "พร้อมเพย์:", size: "xs", color: "#64748b", flex: 3 },
                {
                  type: "text",
                  text: target,
                  size: "xs",
                  weight: "bold",
                  color: "#0f172a",
                  flex: 5,
                  align: "end",
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "ชื่อบัญชี:", size: "xs", color: "#64748b", flex: 3 },
                {
                  type: "text",
                  text: accountName,
                  size: "xs",
                  weight: "bold",
                  color: "#0f172a",
                  flex: 5,
                  align: "end",
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "ธนาคาร:", size: "xs", color: "#64748b", flex: 3 },
                {
                  type: "text",
                  text: bankName,
                  size: "xs",
                  weight: "bold",
                  color: "#0f172a",
                  flex: 5,
                  align: "end",
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "เลขที่บัญชี:", size: "xs", color: "#64748b", flex: 3 },
                {
                  type: "text",
                  text: bankAccountNo,
                  size: "xs",
                  weight: "bold",
                  color: "#0f172a",
                  flex: 5,
                  align: "end",
                },
              ],
            },
          ],
        },
        {
          type: "separator",
          color: "#e2e8f0",
        },
        {
          type: "text",
          text: "💡 โอนเสร็จแล้ว ส่งรูปสลิปลงในแชทนี้ ระบบจะบันทึกยอดเงินเข้ากองกลางทันที",
          size: "xxs",
          color: "#64748b",
          wrap: true,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "16px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#059669",
          height: "sm",
          action: {
            type: "uri",
            label: "📱 เปิดโอนเงิน & บันทึก QR ใน Mini App",
            uri: `${liffUrl}?action=transfer${hasAmount ? `&amount=${amount}` : ""}`,
          },
        },
      ],
    },
  };

  // If public QR image is available, add compact hero image
  if (qrImageUrl) {
    bubbleContents.hero = {
      type: "image",
      url: qrImageUrl,
      size: "full",
      aspectRatio: "4:3",
      aspectMode: "fit",
      backgroundColor: "#ffffff",
    };
  }

  return {
    type: "flex",
    altText,
    contents: bubbleContents,
  };
}

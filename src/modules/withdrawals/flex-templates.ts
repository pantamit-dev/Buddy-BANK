import type { messagingApi } from "@line/bot-sdk";

export function createWithdrawalVotingFlexMessage(params: {
  withdrawalId: string;
  amount: number;
  purpose: string;
  requesterName: string;
  approveVotes: number;
  rejectVotes: number;
  requiredApprovals: number;
  expiresAt: string;
}): messagingApi.FlexMessage {
  const {
    withdrawalId,
    amount,
    purpose,
    requesterName,
    approveVotes,
    rejectVotes,
    requiredApprovals,
    expiresAt,
  } = params;

  return {
    type: "flex",
    altText: `🗳️ มีคำขอเบิกเงินกองกลาง ฿${amount.toLocaleString()} โดย ${requesterName}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0F172A",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "🗳️ โหวตขอเบิกเงินกองกลาง",
            weight: "bold",
            color: "#38BDF8",
            size: "sm",
          },
          {
            type: "text",
            text: `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
            weight: "bold",
            color: "#FFFFFF",
            size: "xxl",
            margin: "md",
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
            layout: "horizontal",
            contents: [
              { type: "text", text: "วัตถุประสงค์", color: "#64748B", size: "sm", flex: 2 },
              { type: "text", text: purpose, color: "#1E293B", size: "sm", flex: 4, weight: "bold", wrap: true },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ผู้ขอเบิก", color: "#64748B", size: "sm", flex: 2 },
              { type: "text", text: requesterName, color: "#1E293B", size: "sm", flex: 4 },
            ],
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
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: `✅ เห็นชอบ: ${approveVotes} เสียง`, size: "xs", color: "#16A34A", weight: "bold" },
                  { type: "text", text: `❌ คัดค้าน: ${rejectVotes} เสียง`, size: "xs", color: "#DC2626", align: "end" },
                ],
              },
              {
                type: "text",
                text: `ต้องการเสียงเห็นชอบอย่างน้อย ${requiredApprovals} เสียง`,
                size: "xxs",
                color: "#64748B",
              },
              {
                type: "text",
                text: `สิ้นสุดการลงคะแนน: ${new Date(expiresAt).toLocaleDateString("th-TH")}`,
                size: "xxs",
                color: "#94A3B8",
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#16A34A",
            height: "sm",
            action: {
              type: "postback",
              label: "✅ เห็นชอบ",
              data: `action=vote_withdrawal&withdrawal_id=${withdrawalId}&choice=approve`,
              displayText: "ฉันเห็นชอบการเบิกเงินนี้",
            },
          },
          {
            type: "button",
            style: "secondary",
            color: "#EF4444",
            height: "sm",
            action: {
              type: "postback",
              label: "❌ คัดค้าน",
              data: `action=vote_withdrawal&withdrawal_id=${withdrawalId}&choice=reject`,
              displayText: "ฉันคัดค้านการเบิกเงินนี้",
            },
          },
        ],
      },
    },
  };
}

export function createWithdrawalResultFlexMessage(params: {
  amount: number;
  purpose: string;
  status: "approved" | "rejected";
  approveVotes: number;
  rejectVotes: number;
  newBalance?: number;
}): messagingApi.FlexMessage {
  const { amount, purpose, status, approveVotes, rejectVotes, newBalance } = params;
  const isApproved = status === "approved";

  return {
    type: "flex",
    altText: `📢 ผลการโหวตเบิกเงิน: ${isApproved ? "อนุมัติเรียบร้อย" : "ไม่อนุมัติ"} (฿${amount.toLocaleString()})`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: isApproved ? "#15803D" : "#B91C1C",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: isApproved ? "✅ การเบิกเงินได้รับการอนุมัติ" : "❌ การเบิกเงินไม่ผ่านการเห็นชอบ",
            weight: "bold",
            color: "#FFFFFF",
            size: "md",
          },
          {
            type: "text",
            text: `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
            weight: "bold",
            color: "#FFFFFF",
            size: "xxl",
            margin: "md",
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
              { type: "text", text: "รายการ", color: "#64748B", size: "sm", flex: 2 },
              { type: "text", text: purpose, color: "#1E293B", size: "sm", flex: 4, weight: "bold", wrap: true },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "คะแนนเสียง", color: "#64748B", size: "sm", flex: 2 },
              { type: "text", text: `เห็นชอบ ${approveVotes} / คัดค้าน ${rejectVotes}`, color: "#1E293B", size: "sm", flex: 4 },
            ],
          },
          ...(isApproved && newBalance !== undefined
            ? [
                {
                  type: "box" as const,
                  layout: "horizontal" as const,
                  contents: [
                    { type: "text" as const, text: "ยอดกองกลางคงเหลือ", color: "#64748B", size: "sm", flex: 2 },
                    {
                      type: "text" as const,
                      text: `฿${newBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
                      color: "#15803D",
                      size: "sm",
                      flex: 4,
                      weight: "bold" as const,
                    },
                  ],
                },
              ]
            : []),
        ],
      },
    },
  };
}

import { LedgerService } from "@/modules/ledger/service";
import { MembershipService } from "@/modules/membership/service";
import { WithdrawalService } from "@/modules/withdrawals/service";
import { createWithdrawalVotingFlexMessage } from "@/modules/withdrawals/flex-templates";
import { calculateMemberContribution } from "@/modules/ledger/balance";
import { formatThaiDate } from "@/lib/utils";
import {
  createGroupBalanceFlexMessage,
  createPersonalBalanceFlexMessage,
  createMemberListFlexMessage,
  createTransactionHistoryFlexMessage,
  createHelpFlexMessage,
  createPromptPayFlexMessage,
  getCommonQuickReply,
} from "@/modules/line-webhook/flex-templates";
import { createAdminClient } from "@/integrations/supabase/server";
import { generatePromptPayPayload } from "@/lib/promptpay";
import QRCode from "qrcode";
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

    let reply: messagingApi.FlexMessage | null = null;

    // 2. Command: #ยอดรวม / #สรุป / #summary
    if (command === "#ยอดรวม" || command === "#สรุป" || command === "#summary") {
      const targetAmount = Number(group.target_amount || 0);
      const [summary, membersCountRes] = await Promise.all([
        this.ledgerService.getGroupBalanceSummary(group.id, targetAmount),
        this.supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id)
          .eq("status", "active"),
      ]);

      reply = createGroupBalanceFlexMessage({
        groupName: group.name,
        totalBalance: summary.totalBalance,
        targetAmount: summary.targetAmount,
        percentage: summary.percentage,
        memberCount: membersCountRes.count || 1,
        liffUrl,
      });
    }

    // 3. Command: #ยอดฉัน / #ยอดผม / #mybalance
    else if (command === "#ยอดฉัน" || command === "#ยอดผม" || command === "#mybalance") {
      if (!lineUserId) {
        return null;
      }

      const member = await this.membershipService.getMemberByLineUserId(
        group.id,
        lineUserId
      );

      if (!member || member.status !== "active") {
        reply = {
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
                  color: "#087963",
                  action: {
                    type: "uri",
                    label: "📱 เปิดระบบ Mini App ยืนยันบัญชี",
                    uri: liffUrl,
                  },
                },
              ],
            },
          },
        };
      } else {
        const summary = await this.ledgerService.getGroupBalanceSummary(group.id);
        const contribution = await this.ledgerService.getMemberContribution(
          group.id,
          member.memberId
        );

        reply = createPersonalBalanceFlexMessage({
          memberName: member.displayName,
          personalTotal: contribution.personalTotal,
          groupTotal: summary.totalBalance,
          percentageOfPool: contribution.personalSharePercentage,
          role: member.role,
          liffUrl,
        });
      }
    }

    // 4. Command: #รายชื่อ / #สมาชิก / #ยอดสมาชิก / #ยอดทุกคน / #members
    else if (
      command === "#รายชื่อ" ||
      command === "#สมาชิก" ||
      command === "#ยอดสมาชิก" ||
      command === "#ยอดทุกคน" ||
      command === "#members"
    ) {
      const [{ data: members }, { data: allEntries }, summary] = await Promise.all([
        this.supabase
          .from("group_members")
          .select("id, role, status, profiles(id, display_name, picture_url)")
          .eq("group_id", group.id)
          .order("joined_at", { ascending: true }),
        this.supabase
          .from("ledger_entries")
          .select("entry_type, amount, member_id")
          .eq("group_id", group.id),
        this.ledgerService.getGroupBalanceSummary(group.id),
      ]);

      const groupEntries = allEntries || [];
      const memberList = (members || []).map((m: any) => {
        const contribution = calculateMemberContribution(groupEntries, m.id);
        return {
          displayName: m.profiles?.display_name || "สมาชิก",
          role: m.role || "member",
          contributionTotal: contribution.personalTotal,
          sharePercentage: contribution.personalSharePercentage,
          status: m.status || "active",
        };
      });

      reply = createMemberListFlexMessage({
        groupName: group.name,
        members: memberList,
        totalBalance: summary.totalBalance,
        liffUrl,
      });
    }

    // 5. Command: #ประวัติ / #ประวัติการโอน / #สลิป / #history
    else if (
      command === "#ประวัติ" ||
      command === "#ประวัติการโอน" ||
      command === "#สลิป" ||
      command === "#history"
    ) {
      const { data: recentDeposits } = await this.supabase
        .from("deposits")
        .select("detected_amount, created_at, status, group_members(profiles(display_name))")
        .eq("group_id", group.id)
        .eq("status", "verified")
        .order("created_at", { ascending: false })
        .limit(5);

      const transactions = (recentDeposits || []).map((d: any) => ({
        amount: Number(d.detected_amount || 0),
        depositorName: (d.group_members as any)?.profiles?.display_name || "สมาชิก",
        createdAt: formatThaiDate(d.created_at),
      }));

      reply = createTransactionHistoryFlexMessage({
        groupName: group.name,
        transactions,
        liffUrl,
      });
    }

    // 6. Command: #ช่วยเหลือ / #คำสั่ง / #help
    else if (command === "#ช่วยเหลือ" || command === "#คำสั่ง" || command === "#help") {
      reply = createHelpFlexMessage(liffUrl);
    }

    // 7. Command: #โอนเงิน / #โอน / #qr
    else if (
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

      // Generate EMVCo PromptPay QR Code Image and upload to Supabase Storage for reliable LINE preview
      let qrImageUrl: string | undefined;
      try {
        const payload = generatePromptPayPayload(target, amount);
        const qrBuffer = await QRCode.toBuffer(payload, {
          width: 480,
          margin: 2,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        });

        const cleanTarget = target.replace(/[^0-9]/g, "");
        const safeAmount = amount ? Math.round(amount * 100) : 0;
        const storagePath = `qr_codes/${group.id}_${cleanTarget}_${safeAmount}.png`;

        const { error: uploadErr } = await this.supabase.storage
          .from("slips")
          .upload(storagePath, qrBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (!uploadErr) {
          const { data: signedData } = await this.supabase.storage
            .from("slips")
            .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

          if (signedData?.signedUrl) {
            qrImageUrl = signedData.signedUrl;
          }
        }
      } catch (qrErr) {
        console.error("[CommandHandler] Failed to upload QR image to Supabase Storage:", qrErr);
      }

      // Fallback: Check if NEXT_PUBLIC_APP_URL is available
      if (!qrImageUrl) {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
        if (appUrl) {
          qrImageUrl = `${appUrl}/api/promptpay/generate?groupId=${group.id}&format=png${
            amount ? `&amount=${amount}` : ""
          }`;
        }
      }

      reply = createPromptPayFlexMessage({
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

    // 8. Command: #เบิก / #ถอน / #withdraw <amount> <purpose>
    else if (
      command === "#เบิก" ||
      command.startsWith("#เบิก ") ||
      command === "#เบิกเงิน" ||
      command.startsWith("#เบิกเงิน ") ||
      command === "#ถอน" ||
      command.startsWith("#ถอน ") ||
      command === "#ถอนเงิน" ||
      command.startsWith("#ถอนเงิน ") ||
      command === "#withdraw" ||
      command.startsWith("#withdraw ")
    ) {
      const match = trimmed.match(/^#(?:เบิกเงิน|เบิก|ถอนเงิน|ถอน|withdraw)\s+([\d,]+(?:\.\d{1,2})?)\s+(.+)$/i);

      if (!match) {
        reply = {
          type: "flex",
          altText: "วิธีใช้คำสั่งเบิกเงินกองกลาง (#เบิก)",
          contents: {
            type: "bubble",
            body: {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: "🗳️ เสนอเบิกเงิน / ลงมติกองกลาง",
                  weight: "bold",
                  color: "#0F172A",
                  size: "md",
                },
                {
                  type: "text",
                  text: "พิมพ์คำสั่งตามรูปแบบ:\n#เบิก [จำนวนเงิน] [วัตถุประสงค์]\nตัวอย่าง: #เบิก 1500 ค่าที่พักคืนแรก",
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
                  color: "#087963",
                  action: {
                    type: "uri",
                    label: "📱 เปิดหน้าเบิกเงิน & โหวต",
                    uri: `${liffUrl}?groupId=${group.id}`,
                  },
                },
              ],
            },
          },
        };
      } else if (!lineUserId) {
        return null;
      } else {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        const purpose = match[2].trim();
        const member = await this.membershipService.getMemberByLineUserId(
          group.id,
          lineUserId
        );

        if (!member || member.status !== "active") {
          reply = {
            type: "flex",
            altText: "เฉพาะสมาชิกที่ได้รับการอนุมัติเท่านั้นที่สามารถขอเบิกเงินได้",
            contents: {
              type: "bubble",
              body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "⚠️ ไม่มีสิทธิ์เสนอเบิกเงิน",
                    weight: "bold",
                    color: "#d97706",
                    size: "md",
                  },
                  {
                    type: "text",
                    text: "เฉพาะสมาชิกที่ได้รับการอนุมัติในกลุ่มเท่านั้นที่สามารถเสนอขอเบิกเงินได้",
                    size: "xs",
                    color: "#475569",
                    wrap: true,
                  },
                ],
              },
            },
          };
        } else {
          try {
            const withdrawalService = new WithdrawalService(this.supabase);
            const withdrawal = await withdrawalService.createWithdrawalRequest({
              groupId: group.id,
              requestedByMemberId: member.memberId,
              amount,
              purpose,
            });

            const [{ data: settings }, { count: activeCount }] = await Promise.all([
              this.supabase
                .from("group_settings")
                .select("voting_quorum_percent")
                .eq("group_id", group.id)
                .maybeSingle(),
              this.supabase
                .from("group_members")
                .select("id", { count: "exact", head: true })
                .eq("group_id", group.id)
                .eq("status", "active"),
            ]);

            const quorumPercent = Number(settings?.voting_quorum_percent || 50);
            const totalMembers = activeCount || 1;
            const requiredApprovals = Math.max(
              1,
              Math.ceil((totalMembers * quorumPercent) / 100)
            );

            reply = createWithdrawalVotingFlexMessage({
              withdrawalId: withdrawal.id,
              amount: Number(withdrawal.amount),
              purpose: withdrawal.purpose,
              requesterName: member.displayName || "สมาชิก",
              approveVotes: 0,
              rejectVotes: 0,
              requiredApprovals,
              expiresAt: withdrawal.expires_at,
            });
          } catch (err: any) {
            const errMsg = err?.message || "ไม่สามารถสร้างคำขอเบิกเงินได้";
            reply = {
              type: "flex",
              altText: "ไม่สามารถสร้างคำขอเบิกเงินได้",
              contents: {
                type: "bubble",
                body: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  contents: [
                    {
                      type: "text",
                      text: "⚠️ ไม่สามารถเสนอเบิกเงินได้",
                      weight: "bold",
                      color: "#DC2626",
                      size: "md",
                    },
                    {
                      type: "text",
                      text: errMsg.includes("INSUFFICIENT_POOL_BALANCE")
                        ? "ยอดเงินคงเหลือในกองกลางไม่เพียงพอสำหรับคำขอเบิกนี้"
                        : errMsg,
                      size: "xs",
                      color: "#475569",
                      wrap: true,
                    },
                  ],
                },
              },
            };
          }
        }
      }
    }

    // Attach Quick Reply action chips to every recognized command response
    if (reply) {
      reply.quickReply = getCommonQuickReply();
    }

    return reply;
  }
}

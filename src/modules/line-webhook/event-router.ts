import type { WebhookEvent } from "@line/bot-sdk";
import { LineApiClient, defaultLineClient } from "./line-client";
import { CommandHandler } from "@/modules/commands/handler";
import { DepositService } from "@/modules/deposits/service";
import { MembershipService } from "@/modules/membership/service";
import { recognizeSlipImage } from "@/modules/ocr/tesseract-worker";
import { parseBankSlipText } from "@/modules/ocr/parser";
import { extractSlipWithGeminiVision } from "@/modules/ocr/gemini-extractor";
import {
  createWelcomeFlexMessage,
  createSlipReviewFlexMessage,
  createDepositApprovedFlexMessage,
  createDuplicateSlipFlexMessage,
  createMembershipRequiredFlexMessage,
} from "./flex-templates";
import { canReviewDepositsWithTemp, canSubmitSlips } from "@/modules/membership/rbac";
import { createAdminClient } from "@/integrations/supabase/server";
import { HybridAiQueryRouter } from "@/modules/ai/query-router";
import { WithdrawalService } from "@/modules/withdrawals/service";
import { createWithdrawalResultFlexMessage } from "@/modules/withdrawals/flex-templates";

export class LineEventRouter {
  private lineClient: LineApiClient;
  private commandHandler: CommandHandler;
  private depositService: DepositService;
  private membershipService: MembershipService;
  private supabase = createAdminClient();

  constructor(lineClient: LineApiClient = defaultLineClient) {
    this.lineClient = lineClient;
    this.commandHandler = new CommandHandler();
    this.depositService = new DepositService(this.supabase);
    this.membershipService = new MembershipService(this.supabase);
  }

  /**
   * Processes a list of webhook events
   */
  async handleEvents(events: WebhookEvent[]) {
    const results = [];
    for (const event of events) {
      try {
        const result = await this.handleSingleEvent(event);
        results.push(result);
      } catch (err) {
        console.error("[LineEventRouter] Error processing event:", err);
        results.push({ success: false, error: String(err) });
      }
    }
    return results;
  }

  /**
   * Handles a single LINE Webhook Event
   */
  async handleSingleEvent(event: WebhookEvent): Promise<any> {
    const eventId = (event as any).webhookEventId;

    // Deduplicate event using webhook_events table
    if (eventId) {
      const { data: existing } = await this.supabase
        .from("webhook_events")
        .select("event_id")
        .eq("event_id", eventId)
        .maybeSingle();

      if (existing) {
        return { success: true, deduplicated: true };
      }

      await this.supabase.from("webhook_events").insert({
        event_id: eventId,
        event_type: event.type,
        payload: event as any,
      });
    }

    // 1. Join Event (Bot added to a group)
    if (event.type === "join" && event.source.type === "group") {
      const groupId = event.source.groupId;
      return await this.handleGroupJoin(groupId, event.replyToken);
    }

    // 2. Text Message Event
    if (
      event.type === "message" &&
      event.message.type === "text" &&
      event.source.type === "group"
    ) {
      return await this.handleTextMessage({
        text: event.message.text,
        groupId: event.source.groupId,
        userId: event.source.userId,
        replyToken: event.replyToken,
      });
    }

    // 3. Image Message Event (Slip submission)
    if (
      event.type === "message" &&
      event.message.type === "image" &&
      event.source.type === "group"
    ) {
      return await this.handleImageMessage({
        messageId: event.message.id,
        groupId: event.source.groupId,
        userId: event.source.userId,
        replyToken: event.replyToken,
      });
    }

    // 4. Postback Event (Slip approval / rejection action)
    if (event.type === "postback") {
      return await this.handlePostback({
        data: event.postback.data,
        source: event.source,
        replyToken: event.replyToken,
      });
    }

    return { success: true, unhandledType: event.type };
  }

  /**
   * Handles Bot Join Group Event
   */
  private async handleGroupJoin(lineGroupId: string, replyToken?: string) {
    // Upsert group record
    const { data: group } = await this.supabase
      .from("groups")
      .select("id")
      .eq("line_group_id", lineGroupId)
      .maybeSingle();

    if (!group) {
      await this.supabase.from("groups").insert({
        line_group_id: lineGroupId,
        name: "กลุ่มกองกลาง",
        target_amount: 10000.0,
      });
    }

    const liffUrl = process.env.NEXT_PUBLIC_LIFF_ID
      ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}?lineGroupId=${lineGroupId}`
      : `https://line.me?lineGroupId=${lineGroupId}`;

    if (replyToken) {
      const welcomeFlex = createWelcomeFlexMessage(liffUrl);
      await this.lineClient.replyMessage(replyToken, [welcomeFlex]);
    }

    return { success: true, event: "join", lineGroupId };
  }

  /**
   * Handles Text Message Commands
   */
  private async handleTextMessage(params: {
    text: string;
    groupId: string;
    userId?: string;
    replyToken?: string;
  }) {
    const { text, groupId, userId, replyToken } = params;

    const flexReply = await this.commandHandler.handleCommand({
      text,
      lineGroupId: groupId,
      lineUserId: userId,
    });

    if (flexReply && replyToken) {
      await this.lineClient.replyMessage(replyToken, [flexReply]);
      return { success: true, commandExecuted: true };
    }

    // On-Demand Hybrid AI Query Router (@Bot / @MoneyPoolBot)
    if (HybridAiQueryRouter.isBotMention(text)) {
      const { data: group } = await this.supabase
        .from("groups")
        .select("id")
        .eq("line_group_id", groupId)
        .maybeSingle();

      if (group && replyToken) {
        const aiRouter = new HybridAiQueryRouter(this.supabase);
        const replyText = await aiRouter.handleGroupQuery(group.id, text);
        await this.lineClient.replyMessage(replyToken, [{ type: "text", text: replyText }]);
        return { success: true, aiHandled: true };
      }
    }

    return { success: true, ignored: true };
  }

  /**
   * Handles Image Message (Bank Slip OCR and Review Card)
   */
  private async handleImageMessage(params: {
    messageId: string;
    groupId: string;
    userId?: string;
    replyToken?: string;
  }) {
    const { messageId, groupId: lineGroupId, userId, replyToken } = params;

    // 1. Resolve Group
    const { data: group } = await this.supabase
      .from("groups")
      .select("id")
      .eq("line_group_id", lineGroupId)
      .maybeSingle();

    if (!group) {
      return { success: false, reason: "Group not registered" };
    }

    // 2. Resolve or Verify Member (Strict Onboarding Gate - Goal G2)
    const member = userId
      ? await this.membershipService.getMemberByLineUserId(group.id, userId)
      : null;

    if (!member || !canSubmitSlips(member.status)) {
      const liffUrl = process.env.NEXT_PUBLIC_LIFF_ID
        ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}?groupId=${group.id}&lineGroupId=${lineGroupId}`
        : `https://line.me?groupId=${group.id}&lineGroupId=${lineGroupId}`;

      if (replyToken) {
        const notApprovedFlex = createMembershipRequiredFlexMessage(
          liffUrl,
          !member ? "NOT_REGISTERED" : "PENDING_APPROVAL"
        );
        await this.lineClient.replyMessage(replyToken, [notApprovedFlex]);
      }
      return {
        success: false,
        reason: !member ? "MEMBER_NOT_REGISTERED" : "MEMBER_NOT_ACTIVE",
      };
    }

    // 3. Immediately trigger loading animation in group chat
    await this.lineClient.showLoadingAnimation(lineGroupId, 20);

    // 4. Download slip image from LINE
    const imageBuffer = await this.lineClient.getMessageContent(messageId);

    // 5. Extract Slip Data (Primary: Gemini Vision API, Fallback: Local Tesseract OCR)
    let rawOcrText = "";
    let detectedAmount: number | null = null;
    let transferDate: string | null = null;
    let bankReference: string | null = null;

    // A) Try Gemini Multimodal Vision first if API key configured (1-2s, highly accurate on Thai bank slips)
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiResult = await extractSlipWithGeminiVision(imageBuffer);
        if (geminiResult) {
          rawOcrText = geminiResult.rawText || "";
          detectedAmount = geminiResult.amount;
          transferDate = geminiResult.transferDate;
          bankReference = geminiResult.bankReference;
        }
      } catch (geminiErr) {
        console.warn("[LineEventRouter] Gemini Vision extraction error, falling back to local OCR:", geminiErr);
      }
    }

    // B) Fallback to local Tesseract OCR if Gemini did not detect or is not configured
    if (!detectedAmount && !bankReference) {
      try {
        const localText = await recognizeSlipImage(imageBuffer, { timeoutMs: 8000 });
        if (localText) {
          rawOcrText = localText;
          const parsed = parseBankSlipText(localText);
          detectedAmount = parsed.amount;
          transferDate = parsed.transferDate;
          bankReference = parsed.bankReference;
        }
      } catch (ocrErr) {
        console.warn("[LineEventRouter] Local Tesseract OCR failed or timed out:", ocrErr);
      }
    }

    // 6. Check for duplicate bank reference
    if (bankReference) {
      const isDuplicate = await this.depositService.checkDuplicateReference(
        group.id,
        bankReference
      );
      if (isDuplicate) {
        if (replyToken) {
          const dupFlex = createDuplicateSlipFlexMessage(bankReference);
          await this.lineClient.replyMessage(replyToken, [dupFlex]);
        }
        return { success: false, reason: "DUPLICATE_SLIP" };
      }
    }

    // 7. Create Pending Deposit
    const deposit = await this.depositService.createPendingDeposit({
      groupId: group.id,
      memberId: member.memberId,
      imageBuffer,
      rawOcrText,
      detectedAmount,
      transferDate,
      bankReference,
    });

    // 8. Reply with interactive Flex Message Card
    if (replyToken) {
      const reviewFlex = createSlipReviewFlexMessage({
        depositId: deposit.id,
        groupId: group.id,
        uploaderName: member.displayName,
        amount: detectedAmount,
        transferDate: transferDate,
        bankReference: bankReference,
      });

      await this.lineClient.replyMessage(replyToken, [reviewFlex]);
    }

    return { success: true, depositId: deposit.id };
  }

  /**
   * Handles Postback Event (Approve / Reject action from Flex Card)
   */
  private async handlePostback(params: {
    data: string;
    source: any;
    replyToken?: string;
  }) {
    const { data, source, replyToken } = params;
    const urlParams = new URLSearchParams(data);
    const action = urlParams.get("action");
    const chatId = source.groupId || source.userId;

    // A. Handle Group Withdrawal Voting
    if (action === "vote_withdrawal") {
      const withdrawalId = urlParams.get("withdrawal_id");
      const choice = urlParams.get("choice") as "approve" | "reject" | null;

      if (!withdrawalId || !choice) {
        return { success: false, reason: "Invalid withdrawal voting payload" };
      }

      if (chatId) {
        await this.lineClient.showLoadingAnimation(chatId, 15);
      }

      const voterUserId = source.userId;
      if (!voterUserId) return { success: false, reason: "Voter user ID missing" };

      const { data: withdrawal } = await this.supabase
        .from("withdrawals")
        .select("id, group_id, amount, purpose, expires_at")
        .eq("id", withdrawalId)
        .maybeSingle();

      if (!withdrawal) return { success: false, reason: "Withdrawal not found" };

      const voterMember = await this.membershipService.getMemberByLineUserId(
        withdrawal.group_id,
        voterUserId
      );

      if (!voterMember || voterMember.status !== "active") {
        if (replyToken) {
          await this.lineClient.replyMessage(replyToken, [
            { type: "text", text: "⚠️ ขออภัย เฉพาะสมาชิกที่ได้รับการอนุมัติในกลุ่มเท่านั้นที่มีสิทธิ์โหวต" },
          ]);
        }
        return { success: false, reason: "UNAUTHORIZED_VOTER" };
      }

      const withdrawalService = new WithdrawalService(this.supabase);
      const voteResult = await withdrawalService.voteWithdrawal({
        withdrawalId,
        voterMemberId: voterMember.memberId,
        choice,
      });

      if (replyToken) {
        if (voteResult.status === "approved" || voteResult.status === "rejected") {
          const resultFlex = createWithdrawalResultFlexMessage({
            amount: Number(withdrawal.amount),
            purpose: withdrawal.purpose,
            status: voteResult.status,
            approveVotes: voteResult.approveVotes,
            rejectVotes: voteResult.rejectVotes,
          });
          await this.lineClient.replyMessage(replyToken, [resultFlex]);
        } else {
          await this.lineClient.replyMessage(replyToken, [
            {
              type: "text",
              text: `🗳️ บันทึกเสียงของคุณ (${choice === "approve" ? "เห็นชอบ" : "คัดค้าน"}) เรียบร้อยแล้ว!\nปัจจุบันเห็นชอบ ${voteResult.approveVotes}/${voteResult.requiredApprovals} เสียงที่ต้องการ`,
            },
          ]);
        }
      }

      return { success: true, voteResult };
    }

    // B. Handle Deposit Review (Approve / Reject)
    const depositId = urlParams.get("depositId");

    if (!action || !depositId || (action !== "approve" && action !== "reject")) {
      return { success: false, reason: "Invalid postback payload" };
    }

    // 1. Immediately trigger LINE Loading Animation
    if (chatId) {
      await this.lineClient.showLoadingAnimation(chatId, 20);
    }

    const reviewerUserId = source.userId;
    if (!reviewerUserId) {
      return { success: false, reason: "Reviewer user ID missing" };
    }

    // 2. Fetch deposit to inspect group and amount
    const { data: deposit } = await this.supabase
      .from("deposits")
      .select("id, group_id, detected_amount, status")
      .eq("id", depositId)
      .maybeSingle();

    if (!deposit) {
      return { success: false, reason: "Deposit not found" };
    }

    // 3. Authorization check
    const reviewerMember = await this.membershipService.getMemberByLineUserId(
      deposit.group_id,
      reviewerUserId
    );

    if (!reviewerMember || !canReviewDepositsWithTemp(reviewerMember.role, reviewerMember.tempAdminUntil)) {
      if (replyToken) {
        await this.lineClient.replyMessage(replyToken, [
          {
            type: "text",
            text: "⚠️ ขออภัย เฉพาะเจ้าของกลุ่มหรือเหรัญญิกเท่านั้นที่มีสิทธิ์อนุมัติหรือปฏิเสธสลิป",
          },
        ]);
      }
      return { success: false, reason: "UNAUTHORIZED_REVIEWER" };
    }

    // 4. Missing amount guard
    if (
      action === "approve" &&
      (!deposit.detected_amount || Number(deposit.detected_amount) <= 0)
    ) {
      if (replyToken) {
        await this.lineClient.replyMessage(replyToken, [
          {
            type: "text",
            text: "⚠️ ไม่สามารถอนุมัติได้เนื่องจากตรวจไม่พบยอดเงินในสลิป\nกรุณาเปิดหน้า 'ตรวจสลิป' ใน Mini App เพื่อระบุจำนวนเงินด้วยตนเอง",
          },
        ]);
      }
      return { success: false, reason: "AMOUNT_REQUIRED" };
    }

    // 5. Perform atomic review decision
    const result = await this.depositService.reviewDeposit({
      depositId,
      action,
      reviewerLineUserId: reviewerUserId,
    });

    if (!result.success) {
      // Could be duplicate click; safe to ignore
      return { success: false, message: result.message };
    }

    // 6. If approved, reply with confirmation Flex card
    if (action === "approve" && result.ledger && replyToken) {
      const confirmFlex = createDepositApprovedFlexMessage({
        amount: Number(result.deposit.detected_amount),
        totalBalance: result.ledger.newRunningBalance,
        reviewerName: result.reviewer?.displayName || "เหรัญญิก",
      });

      await this.lineClient.replyMessage(replyToken, [confirmFlex]);
    }

    return { success: true, action, depositId };
  }
}

import type { WebhookEvent } from "@line/bot-sdk";
import { LineApiClient, defaultLineClient } from "./line-client";
import { CommandHandler } from "@/modules/commands/handler";
import { DepositService } from "@/modules/deposits/service";
import { MembershipService } from "@/modules/membership/service";
import { recognizeSlipImage } from "@/modules/ocr/tesseract-worker";
import { parseBankSlipText } from "@/modules/ocr/parser";
import {
  createWelcomeFlexMessage,
  createSlipReviewFlexMessage,
  createDepositApprovedFlexMessage,
  createDuplicateSlipFlexMessage,
} from "./flex-templates";
import { createAdminClient } from "@/integrations/supabase/server";

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
      ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
      : "https://line.me";

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

    // 2. Resolve or Verify Member
    let member = userId
      ? await this.membershipService.getMemberByLineUserId(group.id, userId)
      : null;

    if (!member) {
      // Auto-onboard member if possible, or fetch profile from LINE
      let displayName = "สมาชิก";
      let pictureUrl: string | null = null;

      if (userId) {
        const lineProfile = await this.lineClient.getGroupMemberProfile(
          lineGroupId,
          userId
        );
        if (lineProfile) {
          displayName = lineProfile.displayName;
          pictureUrl = lineProfile.pictureUrl || null;
        }
        member = await this.membershipService.onboardMember({
          groupId: group.id,
          lineUserId: userId,
          displayName,
          pictureUrl,
        });
      }
    }

    if (!member) {
      return { success: false, reason: "Unable to identify member" };
    }

    // 3. Immediately trigger loading animation in group chat
    await this.lineClient.showLoadingAnimation(lineGroupId, 20);

    // 4. Download slip image from LINE
    const imageBuffer = await this.lineClient.getMessageContent(messageId);

    // 5. Run OCR and regex parser
    let rawOcrText = "";
    try {
      rawOcrText = await recognizeSlipImage(imageBuffer);
    } catch (ocrErr) {
      console.warn("[LineEventRouter] Local OCR failed or timed out:", ocrErr);
    }

    const parsed = parseBankSlipText(rawOcrText);

    // 6. Check for duplicate bank reference
    if (parsed.bankReference) {
      const isDuplicate = await this.depositService.checkDuplicateReference(
        group.id,
        parsed.bankReference
      );
      if (isDuplicate) {
        if (replyToken) {
          const dupFlex = createDuplicateSlipFlexMessage(parsed.bankReference);
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
      detectedAmount: parsed.amount,
      transferDate: parsed.transferDate,
      bankReference: parsed.bankReference,
    });

    // 8. Reply with interactive Flex Message Card
    if (replyToken) {
      const reviewFlex = createSlipReviewFlexMessage({
        depositId: deposit.id,
        groupId: group.id,
        uploaderName: member.displayName,
        amount: parsed.amount,
        transferDate: parsed.transferDate,
        bankReference: parsed.bankReference,
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
    const action = urlParams.get("action") as "approve" | "reject" | null;
    const depositId = urlParams.get("depositId");
    const chatId = source.groupId || source.userId;

    if (!action || !depositId) {
      return { success: false, reason: "Invalid postback payload" };
    }

    // 1. Immediately trigger LINE Loading Animation
    if (chatId) {
      await this.lineClient.showLoadingAnimation(chatId, 20);
    }

    // 2. Perform atomic review decision
    const result = await this.depositService.reviewDeposit({
      depositId,
      action,
      reviewerLineUserId: source.userId,
    });

    if (!result.success) {
      // Could be duplicate click; safe to ignore
      return { success: false, message: result.message };
    }

    // 3. If approved, reply with confirmation Flex card
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

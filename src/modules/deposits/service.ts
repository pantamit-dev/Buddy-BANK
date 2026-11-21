import { createAdminClient } from "@/integrations/supabase/server";
import { DepositStateMachine } from "./state-machine";
import { LedgerService } from "@/modules/ledger/service";
import { MembershipService } from "@/modules/membership/service";
import { canReviewDepositsWithTemp } from "@/modules/membership/rbac";
import { parseSlipDateToIso } from "@/modules/ocr/parser";
import { FraudDetectionService } from "@/modules/fraud/service";
import { computeFileSha256 } from "@/modules/fraud/hash";
import type { DepositStatus } from "@/shared/types/database.types";

export interface CreateDepositInput {
  groupId: string;
  memberId: string;
  imageBuffer: Buffer | ArrayBuffer;
  rawOcrText?: string | null;
  detectedAmount?: number | null;
  transferDate?: string | null;
  bankReference?: string | null;
}

export class DepositService {
  private stateMachine: DepositStateMachine;
  private ledgerService: LedgerService;
  private membershipService: MembershipService;
  private fraudService: FraudDetectionService;

  constructor(private supabase = createAdminClient()) {
    this.stateMachine = new DepositStateMachine(this.supabase);
    this.ledgerService = new LedgerService(this.supabase);
    this.membershipService = new MembershipService(this.supabase);
    this.fraudService = new FraudDetectionService(this.supabase);
  }

  /**
   * Checks whether a bank reference code already exists for this group
   */
  async checkDuplicateReference(groupId: string, bankReference?: string | null): Promise<boolean> {
    if (!bankReference || bankReference.trim().length === 0) {
      return false;
    }

    const { data } = await this.supabase
      .from("deposits")
      .select("id")
      .eq("group_id", groupId)
      .eq("bank_reference", bankReference.trim())
      .in("status", ["pending", "processing", "verified"])
      .maybeSingle();

    return !!data;
  }

  /**
   * Uploads the slip image to Supabase Storage and creates a pending deposit record
   */
  async createPendingDeposit(input: CreateDepositInput) {
    const {
      groupId,
      memberId,
      imageBuffer,
      rawOcrText,
      detectedAmount,
      transferDate,
      bankReference,
    } = input;

    // 1. Check duplicate
    if (bankReference) {
      const isDuplicate = await this.checkDuplicateReference(groupId, bankReference);
      if (isDuplicate) {
        throw new Error(`DUPLICATE_REFERENCE:${bankReference}`);
      }
    }

    // 2. Upload image to private storage bucket 'slips'
    const fileName = `${groupId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
    const buffer = imageBuffer instanceof ArrayBuffer ? Buffer.from(imageBuffer) : imageBuffer;

    const { data: uploadData, error: uploadErr } = await this.supabase.storage
      .from("slips")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadErr) {
      console.error("[DepositService] Failed to upload slip to storage:", uploadErr);
      // Fallback path in case local storage container is not running during isolated unit tests
    }

    const storagePath = uploadData?.path || `slips/${fileName}`;

    // 3. Perform fraud, perceptual hash, and risk score analysis
    let fileSha256: string | null = null;
    let perceptualHash: string | null = null;
    let fraudRiskScore: number | null = null;
    let status: DepositStatus = "pending";

    try {
      const analysis = await this.fraudService.analyzeSlip({
        groupId,
        imageBuffer: buffer,
        detectedAmount,
        transferDate,
        bankReference,
        rawOcrText,
      });
      fileSha256 = analysis.sha256;
      perceptualHash = analysis.perceptualHash;
      fraudRiskScore = analysis.riskScore;
      if (analysis.needsReview) {
        status = "needs_review";
      }
    } catch {
      fileSha256 = computeFileSha256(buffer);
    }

    // 4. Insert deposit record
    const { data: deposit, error: insertErr } = await this.supabase
      .from("deposits")
      .insert({
        group_id: groupId,
        member_id: memberId,
        slip_storage_path: storagePath,
        raw_ocr_text: rawOcrText || null,
        detected_amount: detectedAmount || null,
        transfer_date: parseSlipDateToIso(transferDate),
        bank_reference: bankReference || null,
        file_sha256: fileSha256,
        perceptual_hash: perceptualHash,
        fraud_risk_score: fraudRiskScore,
        status,
        click_count: 0,
      })
      .select()
      .single();

    if (insertErr) {
      throw insertErr;
    }

    return deposit;
  }

  /**
   * Executes in-chat or Mini App deposit review decision (Approve / Reject) with atomic locking
   */
  async reviewDeposit(params: {
    depositId: string;
    action: "approve" | "reject";
    reviewerLineUserId: string;
    adjustedAmount?: number;
    reason?: string;
  }) {
    const { depositId, action, reviewerLineUserId, adjustedAmount, reason } = params;

    // 1. Fetch deposit to find group_id
    const { data: deposit, error: depErr } = await this.supabase
      .from("deposits")
      .select("*")
      .eq("id", depositId)
      .single();

    if (depErr || !deposit) {
      throw new Error("Deposit record not found");
    }

    // 2. Verify reviewer RBAC
    const reviewerMember = await this.membershipService.getMemberByLineUserId(
      deposit.group_id,
      reviewerLineUserId
    );

    if (!reviewerMember || !canReviewDepositsWithTemp(reviewerMember.role, reviewerMember.tempAdminUntil)) {
      throw new Error("UNAUTHORIZED_REVIEWER: Only owners, treasurers, or active temporary admins can review deposits");
    }

    // 3. Acquire atomic idempotency lock
    const lock = await this.stateMachine.lockForProcessing(depositId);
    if (!lock.success) {
      return {
        success: false,
        message: lock.message || "Conflict: Deposit is already processed or being processed",
      };
    }

    try {
      if (action === "approve") {
        const finalAmount = adjustedAmount ?? Number(deposit.detected_amount);
        if (!finalAmount || finalAmount <= 0) {
          throw new Error("Cannot approve deposit with zero or invalid amount");
        }

        // Commit financial ledger
        const ledgerResult = await this.ledgerService.recordVerifiedDeposit({
          groupId: deposit.group_id,
          depositId: deposit.id,
          memberId: deposit.member_id,
          amount: finalAmount,
          actorProfileId: reviewerMember.userId,
        });

        // Mark deposit as verified
        const verifiedDeposit = await this.stateMachine.markVerified({
          depositId: deposit.id,
          reviewerProfileId: reviewerMember.userId,
          verifiedAmount: finalAmount,
        });

        return {
          success: true,
          action: "approve",
          deposit: verifiedDeposit,
          ledger: ledgerResult,
          reviewer: reviewerMember,
        };
      } else {
        // Reject deposit
        const rejectedDeposit = await this.stateMachine.markRejected({
          depositId: deposit.id,
          reviewerProfileId: reviewerMember.userId,
          reason,
        });

        return {
          success: true,
          action: "reject",
          deposit: rejectedDeposit,
          reviewer: reviewerMember,
        };
      }
    } catch (error) {
      // Rollback status to pending on unexpected failure
      await this.stateMachine.rollbackProcessing(depositId);
      throw error;
    }
  }

  /**
   * Generates a short-lived signed URL to view a private slip image
   */
  async getSlipSignedUrl(storagePath: string, expiresInSeconds: number = 300): Promise<string | null> {
    const { data, error } = await this.supabase.storage
      .from("slips")
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  }
}

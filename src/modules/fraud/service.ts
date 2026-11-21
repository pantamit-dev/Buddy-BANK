import { createAdminClient } from "@/integrations/supabase/server";
import { computeFileSha256 } from "./hash";
import { computePerceptualHash, isNearDuplicate } from "./phash";
import { calculateFraudRiskScore, FraudRiskEvaluationResult } from "./risk-score";
import { verificationRegistry } from "./verification-provider";

export interface SlipFraudAnalysisResult {
  sha256: string;
  perceptualHash: string;
  riskScore: number;
  reasons: string[];
  isDuplicate: boolean;
  needsReview: boolean;
  thirdPartyVerification?: any;
}

export class FraudDetectionService {
  constructor(private supabase = createAdminClient()) {}

  /**
   * Performs full fraud & integrity analysis on an incoming slip:
   * 1. SHA-256 exact binary hash calculation
   * 2. 64-bit dHash perceptual image similarity calculation
   * 3. Cross-reference database for duplicate hashes in the group
   * 4. Heuristic risk score calculation (0-100)
   * 5. Optional verification provider lookup
   */
  async analyzeSlip(params: {
    groupId: string;
    imageBuffer: Buffer | ArrayBuffer;
    detectedAmount?: number | null;
    transferDate?: string | null;
    bankReference?: string | null;
    rawOcrText?: string | null;
    memberDisplayName?: string | null;
    providerName?: string;
  }): Promise<SlipFraudAnalysisResult> {
    const {
      groupId,
      imageBuffer,
      detectedAmount,
      transferDate,
      bankReference,
      rawOcrText,
      memberDisplayName,
      providerName,
    } = params;

    const sha256 = computeFileSha256(imageBuffer);

    // Parallelize CPU-bound perceptual hash calculation and database checks concurrently
    const phashPromise = computePerceptualHash(imageBuffer);

    // 1. Check duplicate SHA-256 in this group
    const shaQueryPromise = this.supabase
      .from("deposits")
      .select("id, file_sha256")
      .eq("group_id", groupId)
      .eq("file_sha256", sha256)
      .in("status", ["pending", "processing", "verified", "needs_review"])
      .maybeSingle();

    // 2. Fetch recent perceptual hashes in this group
    const recentSlipsPromise = this.supabase
      .from("deposits")
      .select("id, perceptual_hash")
      .eq("group_id", groupId)
      .not("perceptual_hash", "is", null)
      .in("status", ["pending", "processing", "verified", "needs_review"])
      .limit(50);

    // 3. Check duplicate bank reference if present
    const refQueryPromise =
      bankReference && bankReference.trim().length > 0
        ? this.supabase
            .from("deposits")
            .select("id")
            .eq("group_id", groupId)
            .eq("bank_reference", bankReference.trim())
            .in("status", ["pending", "processing", "verified", "needs_review"])
            .maybeSingle()
        : Promise.resolve({ data: null });

    const [perceptualHash, shaMatchRes, recentSlipsRes, refMatchRes] = await Promise.all([
      phashPromise,
      shaQueryPromise,
      recentSlipsPromise,
      refQueryPromise,
    ]);

    const isDuplicateSha256 = !!shaMatchRes.data;

    let isDuplicatePhash = false;
    const recentSlips = recentSlipsRes.data;
    if (recentSlips && recentSlips.length > 0) {
      for (const slip of recentSlips) {
        if (slip.perceptual_hash && isNearDuplicate(perceptualHash, slip.perceptual_hash)) {
          isDuplicatePhash = true;
          break;
        }
      }
    }

    const isDuplicateBankRef = !!refMatchRes.data;

    // 4. Calculate Heuristic Risk Score
    const riskEval: FraudRiskEvaluationResult = calculateFraudRiskScore({
      amount: detectedAmount,
      transferDate: transferDate ? new Date(transferDate) : null,
      rawOcrText,
      memberDisplayName,
      isDuplicateSha256,
      isDuplicatePhash,
      isDuplicateBankRef,
    });

    // 5. Third-party provider verification if requested
    let thirdPartyVerification: any = undefined;
    if (providerName) {
      const provider = verificationRegistry.get(providerName) || verificationRegistry.getDefault();
      thirdPartyVerification = await provider.verifySlip(imageBuffer, {
        detectedAmount,
        bankReference,
        transferDate,
      });
      if (!thirdPartyVerification.isValid) {
        riskEval.score = Math.max(riskEval.score, 80);
        riskEval.needsReview = true;
        riskEval.reasons.push(`Third-party verification failed: ${thirdPartyVerification.errorMessage}`);
      }
    }

    const isDuplicate = isDuplicateSha256 || isDuplicatePhash || isDuplicateBankRef;

    return {
      sha256,
      perceptualHash,
      riskScore: riskEval.score,
      reasons: riskEval.reasons,
      isDuplicate,
      needsReview: riskEval.needsReview,
      thirdPartyVerification,
    };
  }
}

export interface FraudRiskEvaluationInput {
  amount?: number | null;
  transferDate?: Date | string | null;
  rawOcrText?: string | null;
  memberDisplayName?: string | null;
  isDuplicateSha256?: boolean;
  isDuplicatePhash?: boolean;
  isDuplicateBankRef?: boolean;
}

export interface FraudRiskEvaluationResult {
  score: number; // 0 to 100
  reasons: string[];
  needsReview: boolean;
}

const COMMON_BANK_KEYWORDS = [
  "โอนเงิน",
  "สำเร็จ",
  "บาท",
  "รหัสอ้างอิง",
  "บัญชี",
  "kbank",
  "scb",
  "bbl",
  "ktb",
  "ttb",
  "bay",
  "gsb",
  "promtpay",
  "พร้อมเพย์",
];

/**
 * Calculates a 0-100 heuristic risk score for a deposit slip.
 * Flagged items (score >= 50) are automatically routed to the 'needs_review' queue.
 */
export function calculateFraudRiskScore(
  input: FraudRiskEvaluationInput,
  suspiciousThreshold = 50
): FraudRiskEvaluationResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. Exact Binary Duplicate
  if (input.isDuplicateSha256) {
    score += 60;
    reasons.push("ไฟล์รูปภาพตรงกับสลิปเดิมทุกประการ (Exact duplicate SHA-256)");
  }

  // 2. Visual Duplicate (pHash near match)
  if (input.isDuplicatePhash) {
    score += 50;
    reasons.push("รูปภาพคล้ายคลึงกับสลิปอื่นสูงมาก (Visual duplicate pHash)");
  }

  // 3. Bank Reference Duplicate
  if (input.isDuplicateBankRef) {
    score += 50;
    reasons.push("รหัสอ้างอิงธนาคารซ้ำกับในระบบ (Duplicate bank reference)");
  }

  // 4. Off-Hour Transfer Check (00:00 - 05:00)
  if (input.transferDate) {
    const date = new Date(input.transferDate);
    if (!isNaN(date.getTime())) {
      const hours = date.getHours();
      if (hours >= 0 && hours < 5) {
        score += 20;
        reasons.push(`โอนในช่วงเวลากลางคืนผิดปกติ (${hours.toString().padStart(2, "0")}:00 - 05:00)`);
      }

      // Check future or stale date (> 3 days)
      const now = Date.now();
      const diffMs = now - date.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffMs < -60000) {
        score += 25;
        reasons.push("เวลาโอนเป็นเวลาในอนาคต (Future timestamp)");
      } else if (diffDays > 3) {
        score += 20;
        reasons.push(`สลิปเก่าเกิน 3 วัน (${Math.floor(diffDays)} วันก่อน)`);
      }
    }
  }

  // 5. Round Amount Check (e.g. 5,000, 10,000 without satang)
  if (input.amount !== undefined && input.amount !== null) {
    if (input.amount >= 1000 && input.amount % 500 === 0) {
      score += 15;
      reasons.push("ยอดโอนเป็นเลขกลมจำนวนมาก (Round high amount)");
    }

    if (input.amount > 20000) {
      score += 20;
      reasons.push("ยอดโอนมีมูลค่าสูงผิดปกติ (> 20,000 THB)");
    }
  }

  // 6. OCR Authenticity & Thai Banking Keywords
  if (input.rawOcrText) {
    const lowerOcr = input.rawOcrText.toLowerCase();
    const matchedKeywords = COMMON_BANK_KEYWORDS.filter((kw) => lowerOcr.includes(kw));

    if (matchedKeywords.length === 0) {
      score += 25;
      reasons.push("ไม่พบคีย์เวิร์ดมาตรฐานของสลิปธนาคาร (Missing bank slip keywords)");
    }

    // 7. Sender / Member Name Mismatch
    if (input.memberDisplayName && input.memberDisplayName.trim().length > 2) {
      const nameParts = input.memberDisplayName.trim().toLowerCase().split(/\s+/);
      const hasAnyPart = nameParts.some(
        (part) => part.length >= 3 && lowerOcr.includes(part)
      );
      if (!hasAnyPart && matchedKeywords.length > 0) {
        score += 20;
        reasons.push("ชื่อผู้โอน/ผู้ส่งในสลิปอาจไม่ตรงกับชื่อสมาชิก");
      }
    }
  }

  // Cap score to 100
  const finalScore = Math.min(100, score);

  return {
    score: finalScore,
    reasons,
    needsReview: finalScore >= suspiciousThreshold,
  };
}

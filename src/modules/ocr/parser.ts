import type { OcrResult } from "@/shared/schemas/deposit.schema";

/**
 * Parses raw OCR text extracted from bank transfer slips
 * Extracts: amount (number), transfer date/time (string), bank reference number, bank name
 */
export function parseBankSlipText(rawText: string): OcrResult {
  if (!rawText || typeof rawText !== "string") {
    return {
      amount: null,
      transferDate: null,
      bankReference: null,
      bankName: null,
      rawText: "",
    };
  }

  const cleanedText = rawText.replace(/\r\n/g, "\n");

  const amount = extractAmount(cleanedText);
  const transferDate = extractDate(cleanedText);
  const bankReference = extractBankReference(cleanedText);
  const bankName = detectBankName(cleanedText);

  return {
    amount,
    transferDate,
    bankReference,
    bankName,
    rawText: cleanedText,
  };
}

/**
 * Extracts transfer amount from slip text
 */
export function extractAmount(text: string): number | null {
  // Common patterns in Thai banking slips:
  // "จำนวนเงิน 1,500.00 บาท", "จำนวนเงิน : 500.00", "ยอดเงิน 2,000.00", "Amount 1,500.00", "โอนเงิน 500.00"
  const amountWithPrefixPatterns = [
    /(?:จำนวนเงิน|ยอดเงิน|โอนเงิน|โอนจำนวน|ยอดโอน|amount|total)\s*[:=]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2}))\s*(?:บาท|baht|thb)/i,
    /(?:baht|thb|฿)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2}))/i,
  ];

  for (const regex of amountWithPrefixPatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  // Fallback: look for floating point pattern ending with .00 or currency format
  const genericAmountMatch = text.match(/\b([0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{2})\b/);
  if (genericAmountMatch && genericAmountMatch[1]) {
    const parsed = parseFloat(genericAmountMatch[1].replace(/,/g, ""));
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

/**
 * Extracts transfer date/time
 */
export function extractDate(text: string): string | null {
  // Match formats like:
  // 21/11/2026, 21-11-2026, 21 พ.ย. 67, 21 พ.ย. 2567, 21 Nov 2026, 12:30, 12:30:45
  const datePatterns = [
    /(\d{1,2}\s*(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i,
    /(\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i,
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/,
    /(\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/,
  ];

  for (const regex of datePatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extracts bank transaction reference number
 */
export function extractBankReference(text: string): string | null {
  // Patterns:
  // "รหัสอ้างอิง: 20261121001"
  // "เลขที่รายการ: 0123456789"
  // "Ref No. / Transaction ID: ..."
  const refPatterns = [
    /(?:รหัสอ้างอิง|เลขที่รายการ|หมายเลขอ้างอิง|ref(?:\s*no\.?|\s*id)?|transaction\s*id)\s*[:=]?\s*([A-Za-z0-9_-]{6,35})/i,
    /\b([0-9]{12,25})\b/, // Raw long bank transaction ID
  ];

  for (const regex of refPatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Detects Thai bank name from text
 */
export function detectBankName(text: string): string | null {
  const bankSignatures: { name: string; pattern: RegExp }[] = [
    { name: "KBank", pattern: /(?:กสิกร|kasikorn|kbank)/i },
    { name: "SCB", pattern: /(?:ไทยพาณิชย์|scb|siam commercial)/i },
    { name: "KTB", pattern: /(?:กรุงไทย|krungthai|ktb)/i },
    { name: "BBL", pattern: /(?:กรุงเทพ|bangkok bank|bbl)/i },
    { name: "TTB", pattern: /(?:ttb|ทหารไทยธนชาต|tmb)/i },
    { name: "GSB", pattern: /(?:ออมสิน|gsb)/i },
    { name: "BAY", pattern: /(?:กรุงศรี|krungsri|bay)/i },
    { name: "PromptPay", pattern: /(?:พร้อมเพย์|promptpay)/i },
  ];

  for (const bank of bankSignatures) {
    if (bank.pattern.test(text)) {
      return bank.name;
    }
  }

  return null;
}

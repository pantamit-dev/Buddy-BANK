import type { OcrResult } from "@/shared/schemas/deposit.schema";

/**
 * Thai month names mapping to 1-indexed months
 */
const THAI_MONTHS: Record<string, number> = {
  "ม.ค.": 1,
  "มกราคม": 1,
  "ก.พ.": 2,
  "กุมภาพันธ์": 2,
  "มี.ค.": 3,
  "มีนาคม": 3,
  "เม.ย.": 4,
  "เมษายน": 4,
  "พ.ค.": 5,
  "พฤษภาคม": 5,
  "มิ.ย.": 6,
  "มิถุนายน": 6,
  "ก.ค.": 7,
  "กรกฎาคม": 7,
  "ส.ค.": 8,
  "สิงหาคม": 8,
  "ก.ย.": 9,
  "กันยายน": 9,
  "ต.ค.": 10,
  "ตุลาคม": 10,
  "พ.ย.": 11,
  "พฤศจิกายน": 11,
  "ธ.ค.": 12,
  "ธันวาคม": 12,
};

const ENGLISH_MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

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
  // Note: We scan all matches globally so that if a zero-fee pattern (e.g. "ค่าธรรมเนียม 0.00 บาท")
  // appears before the actual transfer amount, the parser correctly skips 0 and captures the positive amount.
  const amountPatterns = [
    /(?:จำนวนเงิน|ยอดเงิน|โอนเงิน|โอนจำนวน|ยอดโอน|จำนวน|ยอด|amount|total)\s*[:=]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/gi,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:บาท|baht|thb)/gi,
    /(?:baht|thb|฿)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/gi,
  ];

  for (const regex of amountPatterns) {
    const matches = Array.from(text.matchAll(regex));
    for (const match of matches) {
      if (match && match[1]) {
        const parsed = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
  }

  // Fallback: look for floating point pattern ending with .00 or currency format (with or without comma)
  const genericMatches = Array.from(text.matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\b/g));
  for (const match of genericMatches) {
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Extracts transfer date/time
 */
export function extractDate(text: string): string | null {
  // Match formats like:
  // 21/11/2026, 21-11-2026, 21 พ.ย. 67, 21 พ.ย. 2567, 21 พ.ย. 2569-20:09, 21 พฤศจิกายน 2567, 21 Nov 2026, 12:30, 12:30:45
  const datePatterns = [
    /(\d{1,2}\s*(?:ม\.ค\.|มกราคม|ก\.พ\.|กุมภาพันธ์|มี\.ค\.|มีนาคม|เม\.ย\.|เมษายน|พ\.ค\.|พฤษภาคม|มิ\.ย\.|มิถุนายน|ก\.ค\.|กรกฎาคม|ส\.ค\.|สิงหาคม|ก\.ย\.|กันยายน|ต\.ค\.|ตุลาคม|พ\.ย\.|พฤศจิกายน|ธ\.ค\.|ธันวาคม)\s*\d{2,4}(?:\s*[-–]?\s*\d{1,2}:\d{2}(?::\d{2})?)?)/i,
    /(\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{2,4}(?:\s*[-–]?\s*\d{1,2}:\d{2}(?::\d{2})?)?)/i,
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s*[-–]?\s*\d{1,2}:\d{2}(?::\d{2})?)?)/,
    /(\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:\s*[-–]?\s*\d{1,2}:\d{2}(?::\d{2})?)?)/,
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
 * Robustly parses a bank slip date string into an ISO-8601 UTC timestamp.
 * Handles:
 * - Thai abbreviations and full month names (e.g. 21 พ.ย. 2567, 21 พฤศจิกายน 2569 14:30)
 * - Buddhist Era (BE) years (e.g. 2567 -> 2024, 67 -> 2024)
 * - Slash and hyphen dates (DD/MM/YYYY or YYYY-MM-DD)
 * - English month names (21 Nov 2026)
 * - Never throws RangeError; returns null on unparseable inputs
 */
export function parseSlipDateToIso(dateStr?: string | null): string | null {
  if (!dateStr || typeof dateStr !== "string" || dateStr.trim().length === 0) {
    return null;
  }

  try {
    const trimmed = dateStr.trim();
    const pad = (n: number) => String(n).padStart(2, "0");

    // 1. Thai Date Pattern: e.g. "21 พ.ย. 2569 14:30:15", "21 พ.ย. 2569-20:09", "21 พ.ย. 67 11:30"
    const thaiMatch = trimmed.match(
      /(\d{1,2})\s*(ม\.ค\.|มกราคม|ก\.พ\.|กุมภาพันธ์|มี\.ค\.|มีนาคม|เม\.ย\.|เมษายน|พ\.ค\.|พฤษภาคม|มิ\.ย\.|มิถุนายน|ก\.ค\.|กรกฎาคม|ส\.ค\.|สิงหาคม|ก\.ย\.|กันยายน|ต\.ค\.|ตุลาคม|พ\.ย\.|พฤศจิกายน|ธ\.ค\.|ธันวาคม)\s*(\d{2,4})(?:\s*[-–]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i
    );
    if (thaiMatch) {
      const day = parseInt(thaiMatch[1], 10);
      const month = THAI_MONTHS[thaiMatch[2]];
      let year = parseInt(thaiMatch[3], 10);
      if (year >= 2400) year -= 543;
      else if (year >= 50 && year < 100) year = year + 2500 - 543;
      else if (year < 50) year += 2000;

      const hour = thaiMatch[4] ? parseInt(thaiMatch[4], 10) : 0;
      const min = thaiMatch[5] ? parseInt(thaiMatch[5], 10) : 0;
      const sec = thaiMatch[6] ? parseInt(thaiMatch[6], 10) : 0;

      const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(min)}:${pad(sec)}+07:00`;
      const date = new Date(iso);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // 2. English Date Pattern: e.g. "21 Nov 2026 10:15"
    const engMatch = trimmed.match(
      /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i
    );
    if (engMatch) {
      const day = parseInt(engMatch[1], 10);
      const month = ENGLISH_MONTHS[engMatch[2].toLowerCase()];
      let year = parseInt(engMatch[3], 10);
      if (year < 100) year += 2000;

      const hour = engMatch[4] ? parseInt(engMatch[4], 10) : 0;
      const min = engMatch[5] ? parseInt(engMatch[5], 10) : 0;
      const sec = engMatch[6] ? parseInt(engMatch[6], 10) : 0;

      const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(min)}:${pad(sec)}+07:00`;
      const date = new Date(iso);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // 3. Slash / Hyphen DD/MM/YYYY: e.g. "21/11/2026 12:10"
    const dmyMatch = trimmed.match(
      /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
    );
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10);
      let year = parseInt(dmyMatch[3], 10);
      if (year >= 2400) year -= 543;
      else if (year >= 50 && year < 100) year = year + 2500 - 543;
      else if (year < 50) year += 2000;

      const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
      const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
      const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(min)}:${pad(sec)}+07:00`;
        const date = new Date(iso);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }

    // 4. ISO standard YYYY-MM-DD
    const isoDate = new Date(trimmed);
    if (!isNaN(isoDate.getTime())) {
      return isoDate.toISOString();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts bank transaction reference number
 * Handles:
 * - Common labels: รหัสอ้างอิง, เลขที่รายการ, หมายเลขอ้างอิง, Ref No., Transaction ID
 * - OCR misreadings of Thai label: เล[ขบยง]ที่รายการ, เลยที่รายการะ, etc.
 * - Intermediate words between label and number (e.g. "สแกน", "ตรวจสอบสลิป", "QR")
 * - KBank style transaction IDs (e.g. 016322182344CPM18917)
 * - Standalone alphanumeric transaction IDs containing letters and digits (15-30 chars)
 * - Standalone long numeric transaction IDs (12-25 digits)
 */
export function extractBankReference(text: string): string | null {
  const refPatterns = [
    // 1. Label followed by reference (supporting OCR typos: เลยที่, เลบที่, ะ separator, and intermediate words like สแกน/qr)
    /(?:รหัสอ้างอิง|เล[ขบยง]ที่\s*รายการ|เล[ขบยง]รายการ|หมายเลขอ้างอิง|รหัสรายการ|เล[ขบยง]ที่|ref(?:\s*no\.?|\s*id)?|transaction\s*(?:id|no\.?)|trans\s*id|tx(?:id)?)[\s:=ะ.-]*(?:(?:สแกน|qr|ตรวจสอบสลิป|scan)[\s:=ะ.-]*)*([A-Za-z0-9_-]{6,35})/i,
    // 2. KBank style transaction ID: starts with 01-09 + digits + alphanumeric (length 16-25, e.g. 016322182344CPM18917)
    /\b(0[1-9]\d{8,14}[A-Za-z0-9]{4,12})\b/,
    // 3. Standalone alphanumeric transaction ID containing both letters and digits (length 15-30, e.g. Krungthai Ab46c69223d45424c)
    /\b(?=[A-Za-z0-9]{15,30}\b)(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]+\b/,
    // 4. Raw long bank numeric transaction ID (12-25 digits)
    /\b([0-9]{12,25})\b/,
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

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
export function parseBankSlipText(rawText: string): OcrResult & {
  isoDate?: string | null;
  formattedDate?: string | null;
} {
  if (!rawText || typeof rawText !== "string") {
    return {
      amount: null,
      transferDate: null,
      isoDate: null,
      bankReference: null,
      bankName: null,
      formattedDate: null,
      rawText: "",
    };
  }

  const cleanedText = rawText.replace(/\r\n/g, "\n");

  const amount = extractAmount(cleanedText);
  const rawDateStr = extractDate(cleanedText);
  const isoDate = parseSlipDateToIso(rawDateStr);
  const formattedDate = isoDate ? formatSlipDateThai(isoDate) : rawDateStr;
  const bankReference = extractBankReference(cleanedText);
  const bankName = detectBankName(cleanedText);

  return {
    amount,
    transferDate: rawDateStr,
    isoDate,
    formattedDate,
    bankReference,
    bankName,
    rawText: cleanedText,
  };
}

/**
 * Extracts transfer amount from slip text
 * Handles:
 * - "จำนวนเงิน 5,000.00 บาท", "จำนวน 100.00 บาท", "ยอดเงิน 2,000.00", "Amount 1,500.00"
 * - OCR misreadings of digits in decimals (e.g. 100.O0 -> 100.00)
 * - Skips zero fees e.g. "ค่าธรรมเนียม 0.00 บาท"
 */
export function extractAmount(text: string): number | null {
  if (!text || typeof text !== "string") return null;

  // Clean common OCR decimal misreadings (e.g. O or o instead of 0)
  const normalized = text
    .replace(/(\d+)\.[Oo](\d)/g, "$1.0$2")
    .replace(/(\d+)\.(\d)[Oo]/g, "$1.$20")
    .replace(/(\d+)\.[Oo]{2}/g, "$1.00");

  const amountPatterns = [
    /(?:จำนวนเงิน|ยอดเงิน|โอนเงิน|โอนจำนวน|ยอดโอน|จำนวน|ยอด|amount|total)\s*[:=]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/gi,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:บาท|baht|thb)/gi,
    /(?:baht|thb|฿)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/gi,
  ];

  for (const regex of amountPatterns) {
    const matches = Array.from(normalized.matchAll(regex));
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
  const genericMatches = Array.from(normalized.matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\b/g));
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
 * Handles:
 * - Thai formats: "12 มี.ค. 2566 - 10:30 น.", "18 พ.ย. 2569-20:09", "21 พ.ย. 67 11:30"
 * - English formats: "12 Mar 2026 10:30"
 * - Numeric formats: "12/03/2566 10:30", "2026-11-18 11:23"
 */
export function extractDate(text: string): string | null {
  if (!text || typeof text !== "string") return null;

  const datePatterns = [
    // 1. Thai Date with optional separator (-, ,, space) and optional time (10:30 or 10:30:15) and optional "น."
    /(\d{1,2}\s*(?:ม\.ค\.|มกราคม|ก\.พ\.|กุมภาพันธ์|มี\.ค\.|มีนาคม|เม\.ย\.|เมษายน|พ\.ค\.|พฤษภาคม|มิ\.ย\.|มิถุนายน|ก\.ค\.|กรกฎาคม|ส\.ค\.|สิงหาคม|ก\.ย\.|กันยายน|ต\.ค\.|ตุลาคม|พ\.ย\.|พฤศจิกายน|ธ\.ค\.|ธันวาคม)\s*\d{2,4}(?:\s*[-–,]?\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*น\.?)?)?)/i,
    // 2. English Date with Month name
    /(\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{2,4}(?:\s*[-–,]?\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:hrs?|am|pm)\.?)?)?)/i,
    // 3. DD/MM/YYYY or DD-MM-YYYY
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s*[-–,]?\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*น\.?)?)?)/,
    // 4. YYYY/MM/DD or YYYY-MM-DD
    /(\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:\s*[-–,]?\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*น\.?)?)?)/,
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
 * - Thai abbreviations and full month names (e.g. 12 มี.ค. 2566 - 10:30 น., 21 พ.ย. 2569-20:09)
 * - Buddhist Era (BE) years (e.g. 2566 -> 2023, 2569 -> 2026, 67 -> 2024)
 * - Slash and hyphen dates (DD/MM/YYYY or YYYY-MM-DD)
 * - English month names (21 Nov 2026)
 * - Always applies UTC+7 (Asia/Bangkok) offset
 * - Never throws RangeError; returns null on unparseable inputs
 */
export function parseSlipDateToIso(dateStr?: string | null): string | null {
  if (!dateStr || typeof dateStr !== "string" || dateStr.trim().length === 0) {
    return null;
  }

  try {
    const trimmed = dateStr.trim();
    const pad = (n: number) => String(n).padStart(2, "0");

    // 1. Thai Date Pattern: e.g. "12 มี.ค. 2566 - 10:30 น.", "21 พ.ย. 2569-20:09", "21 พ.ย. 67 11:30"
    const thaiMatch = trimmed.match(
      /(\d{1,2})\s*(ม\.ค\.|มกราคม|ก\.พ\.|กุมภาพันธ์|มี\.ค\.|มีนาคม|เม\.ย\.|เมษายน|พ\.ค\.|พฤษภาคม|มิ\.ย\.|มิถุนายน|ก\.ค\.|กรกฎาคม|ส\.ค\.|สิงหาคม|ก\.ย\.|กันยายน|ต\.ค\.|ตุลาคม|พ\.ย\.|พฤศจิกายน|ธ\.ค\.|ธันวาคม)\s*(\d{2,4})(?:\s*[-–,]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*น\.?)?)?/i
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
      /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{2,4})(?:\s*[-–,]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i
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
      /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s*[-–,]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
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
 * Formats parsed slip date into standard Thai display format
 * e.g. "18 พ.ย. 2569 20:09 น." or "12 มี.ค. 2566 10:30 น."
 */
export function formatSlipDateThai(isoOrDateStr?: string | null): string {
  if (!isoOrDateStr) return "-";
  try {
    const d = new Date(isoOrDateStr);
    if (!isNaN(d.getTime())) {
      return (
        d.toLocaleDateString("th-TH", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " น."
      );
    }
  } catch {
    // fallback
  }
  return isoOrDateStr;
}

/**
 * Extracts bank transaction reference number
 * Handles:
 * - Common labels: รหัสอ้างอิง, เลขที่รายการ, เลขที่อ้างอิง, หมายเลขอ้างอิง, Ref No., Transaction ID
 * - Bangkok Bank prefix: BBL... (e.g. BBL2026031210301234)
 * - KBank format: 01... (e.g. 012345103012345678, 016322182344CPM18917)
 * - SCB / Krungsri / ttb / GSB long numeric IDs (e.g. 202603121030123456)
 * - Krungthai alphanumeric hashes (e.g. Ab46c69223d45424c)
 * - OCR misreadings of Thai label: เล[ขบยง]ที่รายการ, เลยที่รายการะ, etc.
 * - Intermediate words between label and number (e.g. "สแกน", "ตรวจสอบสลิป", "QR")
 */
export function extractBankReference(text: string): string | null {
  if (!text || typeof text !== "string") return null;

  const refPatterns = [
    // 1. Label followed by reference
    /(?:รหัส\s*อ้างอิง|เล[ขบยง]ที่\s*(?:รายการ|อ้างอิง)|เล[ขบยง]\s*(?:รายการ|อ้างอิง)|หมายเลข\s*(?:อ้างอิง|รายการ)|รหัส\s*(?:รายการ|ธุรกรรม)|เล[ขบยง]ที่|ref(?:\s*no\.?|\s*id)?|transaction\s*(?:id|no\.?)|trans\s*id|tx(?:id)?)[\s:=ะ.-]*(?:(?:สแกน|qr|ตรวจสอบสลิป|scan)[\s:=ะ.-]*)*([A-Za-z0-9_-]{6,35})/i,
    // 2. Bangkok Bank specific prefix: BBL followed by alphanumeric
    /\b(BBL[A-Za-z0-9]{10,25})\b/i,
    // 3. KBank style transaction ID: starts with 01-09 + digits + alphanumeric
    /\b(0[1-9]\d{8,14}[A-Za-z0-9]{4,12})\b/,
    // 4. Standalone alphanumeric transaction ID containing both letters and digits (length 15-30)
    /\b(?=[A-Za-z0-9]{15,30}\b)(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]+\b/,
    // 5. Raw long bank numeric transaction ID (14-25 digits)
    /\b([0-9]{14,25})\b/,
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
 * Accurately prioritizes the Sender / Issuer bank (Header & "จาก" block)
 * over the recipient bank ("ไปยัง"), preventing misattribution in interbank transfers.
 * Also ignores person names that contain bank-related words (e.g. "นาย กสิกร").
 */
export function detectBankName(text: string): string | null {
  if (!text || typeof text !== "string") return null;

  // Split text into Sender / Issuer section vs Recipient section
  const recipientSplitRegex = /(?:ไปยัง|ผู้รับเงิน|ถึง|to\s*:)/i;
  const parts = text.split(recipientSplitRegex);
  const senderSlice = parts[0] || text;

  // Clean person name tokens (e.g. "นาย กสิกร รักไทย" -> remove "กสิกร รักไทย" from being mistaken for bank)
  const cleanedSenderSlice = senderSlice.replace(
    /(?:นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|miss)\s+[\u0E00-\u0E7Fa-zA-Z]+(?:\s+[\u0E00-\u0E7Fa-zA-Z]+)?/gi,
    ""
  );

  const bankSignatures: { name: string; pattern: RegExp; headerPattern?: RegExp }[] = [
    {
      name: "KBank",
      pattern: /(?:ธ(?:นาคาร)?\.?\s*กสิกร(?:ไทย)?|k\+|kbank|kasikorn\s*bank|กสิกรไทย)/i,
      headerPattern: /(?:k\+|kbank|kasikorn\s*bank)/i,
    },
    {
      name: "SCB",
      pattern: /(?:ธ(?:นาคาร)?\.?\s*ไทยพาณิชย์|scb(?:\s*easy)?|siam\s*commercial|ไทยพาณิชย์)/i,
      headerPattern: /(?:scb|ไทยพาณิชย์)/i,
    },
    {
      name: "KTB",
      pattern: /(?:ธ(?:นาคาร)?\.?\s*กรุงไทย|krungthai(?:\s*next)?|ktb|กรุงไทย)/i,
      headerPattern: /(?:krungthai|กรุงไทย|ktb)/i,
    },
    {
      name: "BBL",
      pattern: /(?:ธ(?:นาคาร)?\.?\s*กรุงเทพ|bangkok\s*bank|bbl|bualuang|กรุงเทพ)/i,
      headerPattern: /(?:bangkok\s*bank|กรุงเทพ|bbl)/i,
    },
    {
      name: "BAY",
      pattern: /(?:ธ(?:นาคาร)?\.?\s*กรุงศรี(?:อยุธยา)?|krungsri|bay|กรุงศรีอยุธยา|กรุงศรี)/i,
      headerPattern: /(?:krungsri|กรุงศรี|bay)/i,
    },
    {
      name: "TTB",
      pattern: /(?:ธ(?:นาคาร)?\.?\s*(?:ทหารไทยธนชาต|ทหารไทย|ธนชาต)|ttb|tmb|thanachart|ทีทีบี|ทหารไทยธนชาต)/i,
      headerPattern: /(?:ttb|ทหารไทยธนชาต)/i,
    },
    {
      name: "GSB",
      pattern: /(?:ธ(?:นาคาร)?\.?\s*ออมสิน|gsb|government\s*savings|mymo|ออมสิน)/i,
      headerPattern: /(?:ออมสิน|gsb)/i,
    },
    {
      name: "PromptPay",
      pattern: /(?:พร้อมเพย์|promptpay|prompt\s*pay)/i,
    },
    {
      name: "TrueMoney",
      pattern: /(?:ทรูมันนี่|truemoney|true\s*money)/i,
    },
    {
      name: "BAAC",
      pattern: /(?:ธ\.ก\.ส\.|ธกส|baac|เกษตรและสหกรณ์)/i,
    },
    {
      name: "CIMB",
      pattern: /(?:cimb|ซีไอเอ็มบี)/i,
    },
    {
      name: "UOB",
      pattern: /(?:uob|ยูโอบี)/i,
    },
    {
      name: "KKP",
      pattern: /(?:kkp|เกียรตินาคิน)/i,
    },
    {
      name: "LHBANK",
      pattern: /(?:lh\s*bank|lhbank|แลนด์\s*แอนด์\s*เฮ้าส์)/i,
    },
  ];

  // Pass 1: Look at cleaned sender slice (header + จาก without person names)
  for (const bank of bankSignatures) {
    if (bank.pattern.test(cleanedSenderSlice)) {
      return bank.name;
    }
  }

  // Pass 2: Check full text for header pattern
  for (const bank of bankSignatures) {
    if (bank.headerPattern && bank.headerPattern.test(text)) {
      return bank.name;
    }
  }

  // Pass 3: Fallback to sender slice (uncleaned)
  for (const bank of bankSignatures) {
    if (bank.pattern.test(senderSlice)) {
      return bank.name;
    }
  }

  // Pass 4: Fallback to full text matching
  for (const bank of bankSignatures) {
    if (bank.pattern.test(text)) {
      return bank.name;
    }
  }

  return null;
}

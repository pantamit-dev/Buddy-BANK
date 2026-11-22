import QRCode from "qrcode";

/**
 * Formats an EMVCo TLV (Tag-Length-Value) string.
 * @param tag 2-digit tag ID (e.g. '00', '01', '29', '54')
 * @param value The string value
 */
export function formatTlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

/**
 * Standard CRC16-CCITT algorithm for EMVCo QR Codes (Polynomial: 0x1021, Initial: 0xFFFF).
 * Calculates checksum on data including '6304'.
 */
export function calculateCrc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Normalizes and formats target identifier (Mobile phone, Citizen ID, or e-Wallet ID).
 * - Mobile: 10 digits starting with 0 -> formats to '0066' + 9 digits (13 chars)
 * - Citizen / Tax ID: 13 digits
 * - e-Wallet: 15 digits
 */
export function sanitizePromptPayTarget(target: string): {
  type: "mobile" | "citizen_id" | "ewallet" | "unknown";
  formattedTarget: string;
  tag: string;
} {
  const clean = target.replace(/[^0-9]/g, "");

  if (clean.length === 10 && clean.startsWith("0")) {
    // Thai Mobile: 0812345678 -> 0066812345678
    return {
      type: "mobile",
      formattedTarget: `0066${clean.substring(1)}`,
      tag: "01",
    };
  }

  if (clean.length === 13) {
    // Citizen or Tax ID
    return {
      type: "citizen_id",
      formattedTarget: clean,
      tag: "02",
    };
  }

  if (clean.length === 15) {
    // E-Wallet ID
    return {
      type: "ewallet",
      formattedTarget: clean,
      tag: "03",
    };
  }

  // Fallback: Default to mobile/subtag 01
  return {
    type: "unknown",
    formattedTarget: clean.padStart(13, "0"),
    tag: "01",
  };
}

/**
 * Generates an EMVCo standard PromptPay QR payload string.
 * @param target Mobile number (e.g. 081-234-5678), Citizen ID, or e-Wallet ID
 * @param amount Optional transfer amount in THB. If > 0, generates Dynamic QR (Tag 01 = 12).
 */
export function generatePromptPayPayload(target: string, amount?: number | null): string {
  const { formattedTarget, tag } = sanitizePromptPayTarget(target);

  // Subtag 00: Application Identifier (AID) for PromptPay: A000000677010111
  const aid = formatTlv("00", "A000000677010111");
  const targetTag = formatTlv(tag, formattedTarget);
  // Tag 29: Merchant Account Information
  const merchantInfo = formatTlv("29", aid + targetTag);

  let raw = "";
  // 00: Payload Format Indicator (Fixed '01')
  raw += formatTlv("00", "01");

  // 01: Point of Initiation Method ('11' = Static, '12' = Dynamic with amount)
  const isDynamic = typeof amount === "number" && amount > 0;
  raw += formatTlv("01", isDynamic ? "12" : "11");

  // 29: Merchant Account Info
  raw += merchantInfo;

  // 53: Transaction Currency (764 = THB)
  raw += formatTlv("53", "764");

  // 54: Transaction Amount (Only included if amount is specified and > 0)
  if (isDynamic && amount !== null && amount !== undefined) {
    const amountStr = Number(amount).toFixed(2);
    raw += formatTlv("54", amountStr);
  }

  // 58: Country Code (Fixed 'TH')
  raw += formatTlv("58", "TH");

  // 63: Checksum header ('6304')
  raw += "6304";

  // Calculate and append CRC16
  const checksum = calculateCrc16(raw);
  return `${raw}${checksum}`;
}

/**
 * Generates a Base64 Data URL for a PromptPay QR code.
 */
export async function generatePromptPayQrDataUrl(
  target: string,
  amount?: number | null,
  options?: QRCode.QRCodeToDataURLOptions
): Promise<string> {
  const payload = generatePromptPayPayload(target, amount);
  return QRCode.toDataURL(payload, {
    width: 320,
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
    ...options,
  });
}

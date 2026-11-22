import { describe, it, expect } from "vitest";
import {
  formatTlv,
  calculateCrc16,
  sanitizePromptPayTarget,
  generatePromptPayPayload,
  generatePromptPayQrDataUrl,
} from "@/lib/promptpay";

describe("PromptPay EMVCo Generator", () => {
  describe("formatTlv", () => {
    it("should format single digit length with leading zero", () => {
      expect(formatTlv("00", "01")).toBe("000201");
      expect(formatTlv("58", "TH")).toBe("5802TH");
    });

    it("should format double digit length correctly", () => {
      expect(formatTlv("01", "0066812345678")).toBe("01130066812345678");
    });
  });

  describe("calculateCrc16", () => {
    it("should match standard CCITT CRC-16 checksum", () => {
      const data = "00020101021129370016A000000677010111011300668123456785802TH53037646304";
      const checksum = calculateCrc16(data);
      expect(checksum).toBe("5D82");
      expect(checksum.length).toBe(4);
    });
  });

  describe("sanitizePromptPayTarget", () => {
    it("should format 10-digit mobile phone numbers with 0066 prefix", () => {
      const result = sanitizePromptPayTarget("081-234-5678");
      expect(result.type).toBe("mobile");
      expect(result.tag).toBe("01");
      expect(result.formattedTarget).toBe("0066812345678");
    });

    it("should handle 13-digit citizen / tax ID", () => {
      const result = sanitizePromptPayTarget("1-1004-12345-67-8");
      expect(result.type).toBe("citizen_id");
      expect(result.tag).toBe("02");
      expect(result.formattedTarget).toBe("1100412345678");
    });

    it("should handle 15-digit e-wallet ID", () => {
      const result = sanitizePromptPayTarget("140001234567890");
      expect(result.type).toBe("ewallet");
      expect(result.tag).toBe("03");
      expect(result.formattedTarget).toBe("140001234567890");
    });
  });

  describe("generatePromptPayPayload", () => {
    it("should generate static QR payload when amount is not provided", () => {
      const payload = generatePromptPayPayload("0812345678");
      expect(payload).toContain("000201"); // format indicator
      expect(payload).toContain("010211"); // static initiation
      expect(payload).toContain("A000000677010111"); // PromptPay AID
      expect(payload).toContain("0066812345678"); // formatted phone
      expect(payload).toContain("5303764"); // THB currency
      expect(payload).not.toContain("5406"); // no amount tag
      expect(payload).toContain("5802TH"); // Thailand
      expect(payload).toContain("6304"); // Checksum tag
    });

    it("should generate dynamic QR payload with Tag 54 when amount is provided", () => {
      const payload = generatePromptPayPayload("0812345678", 300);
      expect(payload).toContain("010212"); // dynamic initiation
      expect(payload).toContain("5406300.00"); // Tag 54 + length 6 + 300.00
      expect(payload.endsWith("B12B")).toBe(true); // verified CRC
    });

    it("should support floating point amounts", () => {
      const payload = generatePromptPayPayload("0812345678", 125.5);
      expect(payload).toContain("5406125.50");
    });
  });

  describe("generatePromptPayQrDataUrl", () => {
    it("should generate a valid base64 data URL", async () => {
      const dataUrl = await generatePromptPayQrDataUrl("0812345678", 300);
      expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
      expect(dataUrl.length).toBeGreaterThan(500);
    });
  });
});

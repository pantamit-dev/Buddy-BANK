import { describe, it, expect } from "vitest";
import {
  parseBankSlipText,
  extractAmount,
  extractDate,
  extractBankReference,
  detectBankName,
} from "@/modules/ocr/parser";

describe("OCR Slip Parser Unit Tests", () => {
  describe("Amount Extraction", () => {
    it("extracts amount with 'จำนวนเงิน' prefix and commas", () => {
      const text = `
        ธนาคารกสิกรไทย
        โอนเงินสำเร็จ
        จำนวนเงิน 1,500.00 บาท
        วันที่ 21 พ.ย. 2569 14:30
        รหัสอ้างอิง KBANK20261121001
      `;
      const amount = extractAmount(text);
      expect(amount).toBe(1500.0);
    });

    it("extracts amount with colon separator", () => {
      const text = "SCB EASY ยอดเงิน : 350.50 บาท รหัสอ้างอิง 202611211111";
      const amount = extractAmount(text);
      expect(amount).toBe(350.5);
    });

    it("extracts amount with 'Amount' English label", () => {
      const text = "Transfer Successful. Amount: 12,000.00 THB. Ref: BBL998877";
      const amount = extractAmount(text);
      expect(amount).toBe(12000.0);
    });

    it("returns null when no valid amount is present", () => {
      const text = "สวัสดีครับ ขอแจ้งเลขบัญชีสำหรับโอนเงิน";
      const amount = extractAmount(text);
      expect(amount).toBeNull();
    });
  });

  describe("Date Extraction", () => {
    it("extracts Thai formatted date with month abbreviation", () => {
      const text = "โอนเงินสำเร็จ วันที่ 21 พ.ย. 2569 14:30:15";
      const date = extractDate(text);
      expect(date).toBe("21 พ.ย. 2569 14:30:15");
    });

    it("extracts slash formatted date", () => {
      const text = "Date: 21/11/2026 10:15";
      const date = extractDate(text);
      expect(date).toBe("21/11/2026 10:15");
    });

    it("returns null if no date pattern is matched", () => {
      const text = "โอนเงินเสร็จสิ้น ยอด 500 บาท";
      const date = extractDate(text);
      expect(date).toBeNull();
    });
  });

  describe("Bank Reference Extraction", () => {
    it("extracts Thai reference string with 'รหัสอ้างอิง'", () => {
      const text = "รหัสอ้างอิง: 20261121KBANK009988 จำนวนเงิน 500.00 บาท";
      const ref = extractBankReference(text);
      expect(ref).toBe("20261121KBANK009988");
    });

    it("extracts reference with 'เลขที่รายการ'", () => {
      const text = "เลขที่รายการ: SCB9988776655 ยอดโอน 1,200.00 บาท";
      const ref = extractBankReference(text);
      expect(ref).toBe("SCB9988776655");
    });

    it("extracts English 'Ref No.' pattern", () => {
      const text = "Ref No. 012345678901234 Amount 50.00";
      const ref = extractBankReference(text);
      expect(ref).toBe("012345678901234");
    });

    it("extracts raw 16-digit bank transaction ID if prefix is missing", () => {
      const text = "โอนเงิน 202611210000123456 ยอด 300.00 บาท";
      const ref = extractBankReference(text);
      expect(ref).toBe("202611210000123456");
    });
  });

  describe("Bank Name Detection", () => {
    it("detects KBank from text", () => {
      expect(detectBankName("กสิกรไทย โอนเงินสำเร็จ")).toBe("KBank");
      expect(detectBankName("KBANK Transfer")).toBe("KBank");
    });

    it("detects SCB from text", () => {
      expect(detectBankName("ไทยพาณิชย์ Easy App")).toBe("SCB");
    });

    it("detects PromptPay from text", () => {
      expect(detectBankName("พร้อมเพย์ โอนสำเร็จ")).toBe("PromptPay");
    });

    it("returns null for unrecognized text", () => {
      expect(detectBankName("ไม่มีชื่อธนาคาร")).toBeNull();
    });
  });

  describe("Full Slip Parsing", () => {
    it("parses simulated KBank slip correctly", () => {
      const kbankSlip = `
        ธนาคารกสิกรไทย
        โอนเงินสำเร็จ
        21 พ.ย. 2569 09:45
        จำนวนเงิน 2,500.00 บาท
        รหัสอ้างอิง: KBANK20261121001
      `;
      const result = parseBankSlipText(kbankSlip);
      expect(result.amount).toBe(2500.0);
      expect(result.bankName).toBe("KBank");
      expect(result.bankReference).toBe("KBANK20261121001");
      expect(result.transferDate).toContain("21 พ.ย. 2569");
    });

    it("parses simulated SCB slip correctly", () => {
      const scbSlip = `
        SCB EASY
        รายการโอนเงินสำเร็จ
        วันที่ทำรายการ: 21/11/2026 12:10
        จำนวนเงิน : 750.50 บาท
        เลขที่รายการ: 20261121SCB7788
      `;
      const result = parseBankSlipText(scbSlip);
      expect(result.amount).toBe(750.5);
      expect(result.bankName).toBe("SCB");
      expect(result.bankReference).toBe("20261121SCB7788");
      expect(result.transferDate).toBe("21/11/2026 12:10");
    });

    it("handles empty or garbage input gracefully", () => {
      const result = parseBankSlipText("");
      expect(result.amount).toBeNull();
      expect(result.bankReference).toBeNull();
      expect(result.bankName).toBeNull();
    });
  });
});

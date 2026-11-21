import { describe, it, expect } from "vitest";
import {
  parseBankSlipText,
  extractAmount,
  extractDate,
  extractBankReference,
  detectBankName,
  parseSlipDateToIso,
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

    it("extracts integer amounts with Thai Baht suffix without decimals", () => {
      const text = "โอนเงินสำเร็จ 500 บาท รหัส 123456789";
      const amount = extractAmount(text);
      expect(amount).toBe(500.0);
    });

    it("parses Krungthai real slip text accurately", () => {
      const raw = `Krungthai
ทรุงไทย
โอนเงินสำเร็จ
รหัสอ้างอิง Ab46c69223d45424c
จาก
นายพันธมิตร ส
กรุงไทย
XXX-X-XX677-8
ไปยัง
นาย พันธมิตร สำเภามาตา
พร้อมเพย์
XXX XXX 5545
จำนวนเงิน 3,000.00 บาท
ค่าธรรมเนียม 0.00 บาท
วันที่ทำรายการ 21 พ.ย. 2569-20:09`;
      const res = parseBankSlipText(raw);
      expect(res.amount).toBe(3000.0);
      expect(res.bankReference).toBe("Ab46c69223d45424c");
      expect(res.bankName).toBe("KTB");
    });

    it("extracts amount with Thai currency symbol ฿", () => {
      const text = "พร้อมเพย์ สำเร็จ ยอด ฿ 1,250";
      const amount = extractAmount(text);
      expect(amount).toBe(1250.0);
    });

    it("extracts amount when zero fee appears before transfer amount", () => {
      const text = `
        ธนาคารไทยพาณิชย์
        ค่าธรรมเนียม 0.00 บาท
        จำนวนเงิน 2,500.00 บาท
        รหัสอ้างอิง SCB001122
      `;
      const amount = extractAmount(text);
      expect(amount).toBe(2500.0);
    });

    it("extracts floating amount without thousands comma", () => {
      const text = "ยอดโอน 500.00 บาท";
      const amount = extractAmount(text);
      expect(amount).toBe(500.0);
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

    it("extracts Thai date with full month name", () => {
      const text = "วันที่ 21 พฤศจิกายน 2567 14:30 โอนสำเร็จ";
      const date = extractDate(text);
      expect(date).toBe("21 พฤศจิกายน 2567 14:30");
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

  describe("parseSlipDateToIso", () => {
    it("parses Thai Buddhist Era date to valid ISO timestamp without throwing RangeError", () => {
      const iso = parseSlipDateToIso("21 พ.ย. 2569 14:30:15");
      expect(iso).not.toBeNull();
      expect(iso).toContain("2026-11-21");
    });

    it("parses Thai short year e.g. 67 to 2024", () => {
      const iso = parseSlipDateToIso("21 พ.ย. 67 11:30");
      expect(iso).not.toBeNull();
      expect(iso).toContain("2024-11-21");
    });

    it("parses Thai full month name e.g. 21 พฤศจิกายน 2567", () => {
      const iso = parseSlipDateToIso("21 พฤศจิกายน 2567 10:00");
      expect(iso).not.toBeNull();
      expect(iso).toContain("2024-11-21");
    });

    it("parses slash DD/MM/YYYY date", () => {
      const iso = parseSlipDateToIso("21/11/2026 12:10");
      expect(iso).not.toBeNull();
      expect(iso).toContain("2026-11-21");
    });

    it("parses English month date", () => {
      const iso = parseSlipDateToIso("21 Nov 2026 10:15");
      expect(iso).not.toBeNull();
      expect(iso).toContain("2026-11-21");
    });

    it("returns null gracefully on empty or invalid date strings without throwing", () => {
      expect(parseSlipDateToIso("")).toBeNull();
      expect(parseSlipDateToIso(null)).toBeNull();
      expect(parseSlipDateToIso("ข้อความไม่ใช่เวลา")).toBeNull();
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

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

    it("extracts KBank reference when OCR misreads 'เลขที่รายการ' as 'เลยที่รายการะ' with 'สแกน'", () => {
      const text = "เลยที่รายการะ\nสแกน\n016322182344CPM18917 ตรวจสอบสลิป";
      const ref = extractBankReference(text);
      expect(ref).toBe("016322182344CPM18917");
    });

    it("extracts Krungthai alphanumeric hash reference", () => {
      const text = "โอนเงินสำเร็จ\nรหัสอ้างอิง Ab46c69223d45424c\nกรุงไทย";
      const ref = extractBankReference(text);
      expect(ref).toBe("Ab46c69223d45424c");
    });

    it("extracts standalone KBank transaction ID without label", () => {
      const text = "016322182344CPM18917 โอนเงิน 100 บาท";
      const ref = extractBankReference(text);
      expect(ref).toBe("016322182344CPM18917");
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

    it("parses 7 major Thai bank slips accurately from infographic specifications", () => {
      // 1. KBank (Kasikorn)
      const kbank = parseBankSlipText(`
        โอนเงินสำเร็จ K+
        12 มี.ค. 2566 - 10:30 น.
        จาก นาย กสิกร รักไทย ธ.กสิกรไทย xxx-x-x1234-x
        ไปยัง น.ส. กสิกร รักไทย ธ.กสิกรไทย xxx-x-x5678-x
        จำนวนเงิน 5,000.00 บาท
        ค่าธรรมเนียม 0.00 บาท
        เลขที่รายการ: 012345103012345678
        สแกนตรวจสอบสลิป
      `);
      expect(kbank.bankName).toBe("KBank");
      expect(kbank.amount).toBe(5000.0);
      expect(kbank.transferDate).toBe("12 มี.ค. 2566 - 10:30 น.");
      expect(kbank.bankReference).toBe("012345103012345678");

      // 2. SCB (Siam Commercial Bank)
      const scb = parseBankSlipText(`
        โอนเงินสำเร็จ SCB
        12 มี.ค. 2566 - 10:30 น.
        จาก นาย ไทยพาณิชย์ ดีดี ธ.ไทยพาณิชย์ xxx-x-x1111-x
        ไปยัง น.ส. กสิกร รักไทย ธ.กสิกรไทย xxx-x-x5678-x
        จำนวนเงิน 5,000.00 บาท
        ค่าธรรมเนียม 0.00 บาท
        รหัสอ้างอิง: 202603121030123456
        สแกนตรวจสอบสลิป
      `);
      expect(scb.bankName).toBe("SCB");
      expect(scb.amount).toBe(5000.0);
      expect(scb.bankReference).toBe("202603121030123456");

      // 3. Krungthai (KTB)
      const ktb = parseBankSlipText(`
        โอนเงินสำเร็จ Krungthai
        12 มี.ค. 2566 - 10:30 น.
        จาก นาย กรุงไทย ใจดี ธ.กรุงไทย xxx-x-x2222-x
        ไปยัง น.ส. กสิกร รักไทย ธ.กสิกรไทย xxx-x-x5678-x
        จำนวนเงิน 5,000.00 บาท
        ค่าธรรมเนียม 0.00 บาท
        รหัสอ้างอิง: 202603121030123456
        สแกนตรวจสอบสลิป
      `);
      expect(ktb.bankName).toBe("KTB");
      expect(ktb.amount).toBe(5000.0);
      expect(ktb.bankReference).toBe("202603121030123456");

      // 4. Bangkok Bank (BBL)
      const bbl = parseBankSlipText(`
        โอนเงินสำเร็จ Bangkok Bank
        12 มี.ค. 2566 - 10:30 น.
        จาก นาย กรุงเทพ รักไทย ธ.กรุงเทพ xxx-x-x3333-x
        ไปยัง น.ส. กสิกร รักไทย ธ.กสิกรไทย xxx-x-x5678-x
        จำนวนเงิน 5,000.00 บาท
        ค่าธรรมเนียม 0.00 บาท
        เลขที่อ้างอิง BBL2026031210301234
        สแกนตรวจสอบสลิป
      `);
      expect(bbl.bankName).toBe("BBL");
      expect(bbl.amount).toBe(5000.0);
      expect(bbl.bankReference).toBe("BBL2026031210301234");

      // 5. Krungsri (BAY)
      const bay = parseBankSlipText(`
        โอนเงินสำเร็จ krungsri
        12 มี.ค. 2566 - 10:30 น.
        จาก นาย กรุงศรี ดีดี ธ.กรุงศรีอยุธยา xxx-x-x4444-x
        ไปยัง น.ส. กสิกร รักไทย ธ.กสิกรไทย xxx-x-x5678-x
        จำนวนเงิน 5,000.00 บาท
        ค่าธรรมเนียม 0.00 บาท
        เลขที่รายการ: 202603121030123456
        สแกนตรวจสอบสลิป
      `);
      expect(bay.bankName).toBe("BAY");
      expect(bay.amount).toBe(5000.0);
      expect(bay.bankReference).toBe("202603121030123456");

      // 6. TTB (TMBThanachart)
      const ttb = parseBankSlipText(`
        โอนเงินสำเร็จ ttb
        12 มี.ค. 2566 - 10:30 น.
        จาก นาย ทีทีบี รักไทย ธ.ทหารไทยธนชาต xxx-x-x5555-x
        ไปยัง น.ส. กสิกร รักไทย ธ.กสิกรไทย xxx-x-x5678-x
        จำนวนเงิน 5,000.00 บาท
        ค่าธรรมเนียม 0.00 บาท
        รหัสอ้างอิง: 202603121030123456
        สแกนตรวจสอบสลิป
      `);
      expect(ttb.bankName).toBe("TTB");
      expect(ttb.amount).toBe(5000.0);
      expect(ttb.bankReference).toBe("202603121030123456");

      // 7. GSB (Government Savings Bank / ออมสิน)
      const gsb = parseBankSlipText(`
        โอนเงินสำเร็จ ออมสิน GSB
        12 มี.ค. 2566 - 10:30 น.
        จาก นาย ออมสิน ใจดี ธ.ออมสิน xxx-x-x6666-x
        ไปยัง น.ส. กสิกร รักไทย ธ.กสิกรไทย xxx-x-x5678-x
        จำนวนเงิน 5,000.00 บาท
        ค่าธรรมเนียม 0.00 บาท
        เลขที่รายการ: 202603121030123456
        สแกนตรวจสอบสลิป
      `);
      expect(gsb.bankName).toBe("GSB");
      expect(gsb.amount).toBe(5000.0);
      expect(gsb.bankReference).toBe("202603121030123456");
    });

    it("correctly attributes the sender bank in interbank transfers (not recipient bank)", () => {
      // Transfer from SCB to KBank
      const slip = parseBankSlipText(`
        จาก นาย กสิกร ปลายทาง
        ธ.ไทยพาณิชย์
        ไปยัง
        น.ส. สมหญิง
        ธ.กสิกรไทย
        จำนวนเงิน 1,200.00 บาท
        รหัสอ้างอิง: 202603121030123456
      `);
      // Issuer is SCB (from "จาก ธ.ไทยพาณิชย์"), not KBank (recipient)
      expect(slip.bankName).toBe("SCB");
    });
  });
});

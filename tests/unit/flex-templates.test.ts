import { describe, it, expect } from "vitest";
import {
  createSlipReviewFlexMessage,
  createDepositApprovedFlexMessage,
  createWelcomeFlexMessage,
  createNewMemberWelcomeFlexMessage,
} from "@/modules/line-webhook/flex-templates";

describe("Flex Templates Unit Tests", () => {
  describe("createNewMemberWelcomeFlexMessage", () => {
    it("renders welcome flex message with brand styling, quick guide, and verify account button", () => {
      const liffUrl = "https://liff.line.me/test-liff-id?lineGroupId=grp-123&action=verify";
      const flex = createNewMemberWelcomeFlexMessage({
        liffUrl,
        memberNames: ["สมชาย", "สมหญิง"],
        groupName: "เพื่อนเที่ยว 2026",
      });

      expect(flex.type).toBe("flex");
      expect(flex.altText).toContain("ยินดีต้อนรับ คุณ สมชาย, สมหญิง สู่ เพื่อนเที่ยว 2026");
      expect(flex.altText).toContain("คู่มือเบื้องต้น & ยืนยันบัญชี");

      const bubble = flex.contents as any;
      expect(bubble.size).toBe("mega");

      // 1. Header with Bank Buddy brand color (#087963)
      expect(bubble.header.backgroundColor).toBe("#087963");
      expect(bubble.header.contents[0].contents[0].text).toBe("🎉 ยินดีต้อนรับสมาชิกใหม่!");
      expect(bubble.header.contents[1].text).toBe("กลุ่ม: เพื่อนเที่ยว 2026");

      // 2. Body contains greeting and 4-step quick guide
      const bodyItems = bubble.body.contents;
      const greeting = bodyItems[0].text;
      expect(greeting).toContain("คุณ สมชาย, สมหญิง");

      // Find quick guide block
      const guideBox = bodyItems.find((item: any) =>
        item.type === "box" &&
        item.contents?.some((c: any) => c.text?.includes("คู่มือเริ่มต้นใช้งาน"))
      );
      expect(guideBox).toBeDefined();

      const guideTexts = JSON.stringify(guideBox);
      expect(guideTexts).toContain("ยืนยันบัญชีผู้ใช้");
      expect(guideTexts).toContain("ส่งสลิปโอนเงินเข้าแชท");
      expect(guideTexts).toContain("คำสั่งด่วนเช็คยอดเงิน");
      expect(guideTexts).toContain("AI ผู้ช่วยอัจฉริยะ");

      // 3. Footer has action button to open Mini App for verification
      const footerButtons = bubble.footer.contents;
      const verifyBtn = footerButtons[0];
      expect(verifyBtn.type).toBe("button");
      expect(verifyBtn.style).toBe("primary");
      expect(verifyBtn.color).toBe("#087963");
      expect(verifyBtn.action.label).toBe("🚀 เปิด Mini App ยืนยันบัญชี");
      expect(verifyBtn.action.uri).toBe(liffUrl);
    });

    it("handles empty memberNames gracefully with fallback greeting", () => {
      const liffUrl = "https://liff.line.me/test-liff-id";
      const flex = createNewMemberWelcomeFlexMessage({
        liffUrl,
      });

      expect(flex.altText).toContain("สมาชิกใหม่ทุกท่าน");
      const bubble = flex.contents as any;
      expect(bubble.header.contents[1].text).toBe("Bank Buddy — เพื่อนพึ่งพายามยาก");
      expect(bubble.body.contents[0].text).toContain("สมาชิกใหม่ทุกท่าน");
    });
  });

  describe("createWelcomeFlexMessage", () => {
    it("renders welcome flex message with Bank Buddy brand colors and verify button", () => {
      const liffUrl = "https://liff.line.me/test-liff-id";
      const flex = createWelcomeFlexMessage(liffUrl);

      expect(flex.type).toBe("flex");
      expect(flex.altText).toContain("ยินดีต้อนรับสู่ Money Pool (Bank Buddy)");

      const bubble = flex.contents as any;
      expect(bubble.header.backgroundColor).toBe("#087963");
      expect(bubble.header.contents[0].text).toContain("Bank Buddy");

      const verifyBtn = bubble.footer.contents[0];
      expect(verifyBtn.action.uri).toBe(liffUrl);
      expect(verifyBtn.action.label).toBe("🚀 เปิด Mini App ยืนยันบัญชี");
    });
  });
  describe("createSlipReviewFlexMessage", () => {
    it("renders with yellow-orange header, 'จำนวนเงิน' label, right-aligned column 2, and บันทึก/ยกเลิก buttons", () => {
      const flex = createSlipReviewFlexMessage({
        depositId: "dep-123",
        groupId: "grp-456",
        uploaderName: "Save",
        amount: 45.0,
        transferDate: "17 พ.ย. 2569 11:50 น.",
        bankReference: "016321115001DPM07124",
        bankName: "KBank",
      });

      expect(flex.type).toBe("flex");
      expect(flex.altText).toContain("45.00 บาท");

      const bubble = flex.contents as any;

      // 1. Title color is yellow-orange (#f59e0b)
      expect(bubble.header.backgroundColor).toBe("#f59e0b");
      expect(bubble.header.contents[0].text).toBe("🧾 ตรวจพบสลิปโอนเงินใหม่");

      // 2. Keyword changed from "ยอดเงินที่ตรวจพบ" to "จำนวนเงิน"
      const bodyRows = bubble.body.contents;
      const uploaderRow = bodyRows[0].contents;
      const amountRow = bodyRows[1].contents;
      const bankRow = bodyRows[2].contents;
      const dateRow = bodyRows[3].contents;
      const refRow = bodyRows[4].contents;

      expect(amountRow[0].text).toBe("จำนวนเงิน");

      // 3. Column 2 elements must have align: "end" (right-aligned)
      expect(uploaderRow[1].align).toBe("end");
      expect(amountRow[1].align).toBe("end");
      expect(bankRow[1].align).toBe("end");
      expect(dateRow[1].align).toBe("end");
      expect(refRow[1].align).toBe("end");

      // 4. Buttons keyword: (อนุมัติ/ปฏิเสธ) -> (บันทึก/ยกเลิก)
      const footerButtons = bubble.footer.contents;
      const saveBtn = footerButtons[0];
      const cancelBtn = footerButtons[1];

      expect(saveBtn.action.label).toBe("✅ บันทึก");
      expect(saveBtn.action.displayText).toBe("บันทึกรายการ 45.00 บาท");

      expect(cancelBtn.action.label).toBe("❌ ยกเลิก");
      expect(cancelBtn.action.displayText).toBe("ยกเลิกสลิปนี้");
    });
  });

  describe("createDepositApprovedFlexMessage", () => {
    it("renders with 'บันทึกโดย' instead of 'อนุมัติโดย'", () => {
      const flex = createDepositApprovedFlexMessage({
        amount: 45.0,
        totalBalance: 1045.0,
        reviewerName: "เหรัญญิก",
      });

      const bubble = flex.contents as any;
      const bodyItems = bubble.body.contents;
      const reviewerItem = bodyItems.find((item: any) =>
        item.type === "text" && item.text?.includes("บันทึกโดย:")
      );

      expect(reviewerItem).toBeDefined();
      expect(reviewerItem.text).toBe("บันทึกโดย: เหรัญญิก");
    });
  });
});

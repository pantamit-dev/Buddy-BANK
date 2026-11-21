# Release Notes — Bank Buddy v.beta

**Version:** `v.beta` (v0.9.0-beta)  
**Release Date:** 22 พฤศจิกายน 2026  
**Status:** Feature Complete (~100% Core Scope)  
**Verification:** 16 Test Suites, 135 Passed Tests, 0 TypeScript Errors  

---

## 🎯 ภาพรวมการปล่อยเวอร์ชัน v.beta

เวอร์ชัน **`v.beta`** เป็นหมุดหมายสำคัญที่ระบบ **Money Pool (Bank Buddy)** ได้พัฒนาและทดสอบฟังก์ชันหลักครบถ้วนตาม Master Architecture ทั้ง Phase 1, Phase 2 และ Phase 3 ครบวงจร โดยเชื่อมประสานระหว่าง **LINE Group Chat** และ **LINE Mini App (LIFF)** อย่างสมบูรณ์แบบ

---

## 📦 ฟังก์ชันเด่นในเวอร์ชันนี้

1. **ระบบถอดรหัสสลิปโอนเงินความเร็วสูงด้วย AI ท้องถิ่น (OpenThai 2.1 OCR)**
   - ใช้โมเดลโครงข่ายประสาทเทียมภาษาไทย PP-OCRv6 + Thai CTC recognizer รันบนเครื่องท้องถิ่นด้วย OpenVINO / ONNX Runtime
   - ประมวลผลเสร็จสิ้นใน 100–300 ms โดยไม่ต้องส่งรูปสลิปไปยังคลาวด์ภายนอก เพื่อความเป็นส่วนตัวสูงสุด
   - รองรับสลิปธนาคารชั้นนำของไทย: กสิกรไทย (KBank), ไทยพาณิชย์ (SCB), กรุงไทย (KTB), กรุงเทพ (BBL), กรุงศรี (BAY), ทีทีบี (TTB), ออมสิน (GSB) และพร้อมเพย์ (PromptPay)
   - มีระบบ fallback อัตโนมัติไปยัง Tesseract.js กรณีเกิดเหตุขัดข้อง

2. **ระบบ All-in-One Automation & Dynamic Service Discovery**
   - คำสั่งเดียว `npm run dev:all` หรือ `npm run start:all` สามารถเปิดระบบ OCR Server, สร้าง ngrok/Cloudflare tunnel และอัปเดต URL ไปยังฐานข้อมูล Supabase (`system_settings`) ทันที
   - ระบบ Vercel Serverless คลาวด์ค้นหาพิกัด OCR อัตโนมัติแบบ Real-time โดยไม่ต้องแก้ Environment Variables หรือ Deploy ใหม่

3. **ระบบอนุมัติสลิปใน LINE Group แบบ Deterministic ป้องกัน Race Condition**
   - แสดง LINE Loading Animation (`POST /v2/bot/chat/loading/start`) ทันทีที่ผู้ดูแลกดปุ่ม
   - ป้องกันการกดซ้ำซ้อนด้วย Atomic Database Lock (`UPDATE ... WHERE status = 'pending'`) รับประกันยอดเงินไม่เบิ้ล 100%
   - แสดงผลเวลาแบบไทย (วันที่ เดือนไทย พ.ศ. เวลา) บน Flex Message สวยงามเข้าใจง่าย

4. **สมุดบัญชีแยกประเภทคู่ (Immutable Append-Only Ledger)**
   - คำนวณยอดเงินรวมและยอดสมาชิกจากรายการบัญชี `ledger_entries` เท่านั้น ไม่มีการแก้ตัวเลขตรง ๆ ที่ตารางสรุปผล
   - มีการแยกระหว่างสลิปที่แนบ (`deposits`) กับธุรกรรมที่ผ่านการรับรอง (`transactions`) อย่างชัดเจน

5. **ระบบตรวจจับสลิปปลอมและการโกงหลายชั้น (Fraud Detection Engine)**
   - ตรวจจับสลิปซ้ำผ่าน SHA-256 Hash
   - ตรวจจับสลิปที่นำมาครอบตัด/แต่งภาพ/ปรับสี ด้วย Perceptual Hashing (pHash)
   - ประเมินคะแนนความเสี่ยง (Risk Score) อัตโนมัติเพื่อส่งเข้าคิวตรวจสอบพิเศษ
   - รองรับ `VerificationProviderInterface` เพื่อต่อขยาย API ตรวจสอบสลิปภายนอกในอนาคต

6. **ระบบลงคะแนนถอนเงินประชาธิปไตย (Democratic Withdrawal Voting)**
   - สมาชิกหรือผู้ดูแลสามารถเสนอคำขอถอนเงินพร้อมแนบใบเสร็จ
   - ส่งการ์ดโหวต Flex Message เข้าห้อง LINE Chat เพื่อให้สมาชิกลงคะแนน `[เห็นชอบ]` หรือ `[ไม่เห็นชอบ]`
   - มีระบบคำนวณ Quorum ตามเปอร์เซ็นต์ที่กลุ่มตั้งค่าไว้ เมื่อคะแนนผ่านเกณฑ์ ระบบจะบันทึกหักบัญชี (debit) เข้า Ledger ทันที

7. **ระบบกฎการเงินและการออกรายงาน (Rules & Financial Reports)**
   - ระบบประเมินกฎการออมเงิน (กำหนดชำระ, ยอดขั้นต่ำ) พร้อมแสดงสถานะสมาชิก (`on_track`, `due_soon`, `overdue`)
   - ระบบส่งออกรายงานบัญชีแบบ Asynchronous เป็นไฟล์ Excel (`.xlsx`) และ PDF

8. **LINE Mini App (LIFF 2.x) เต็มรูปแบบ**
   - หน้าแดชบอร์ดสรุปยอดและเป้าหมาย (Overview)
   - หน้าประวัติการโอนเงินของฉัน (My Deposits)
   - หน้ารายชื่อสมาชิกและการอนุมัติสิทธิ์ (Group Members & RBAC)
   - หน้าตรวจสอบสลิปละเอียด (Review)
   - หน้าตั้งค่ากฎกลุ่ม (Settings)
   - หน้าดาวน์โหลดรายงาน (Reports)
   - ผู้ช่วย AI อัจฉริยะ (Financial Copilot) พร้อมระบบ Privacy Filter ป้องกันข้อมูลการเงินส่วนบุคคลรั่วไหล

---

## 🛡️ ผลการทดสอบและเกณฑ์คุณภาพ (Quality Gate)

- **TypeScript Type-Check:** ผ่าน 100% (0 errors)
- **Unit & Integration Tests:** 16 ไฟล์ทดสอบ, 135 เคสทดสอบ ผ่านครบถ้วน 100%
  - `ledger-balance.test.ts` (9 tests)
  - `rls-isolation.test.ts` (8 tests)
  - `ocr-parser.test.ts` (35 tests)
  - `rule-evaluator.test.ts` (10 tests)
  - `command-router.test.ts` (8 tests)
  - `voting-quorum.test.ts` (9 tests)
  - `ai-query-router.test.ts` (7 tests)
  - `background-job-runner.test.ts` (6 tests)
  - `membership-lifecycle.test.ts` (6 tests)
  - `deposit-approval.test.ts` (6 tests)
  - `fraud-pipeline.test.ts` (3 tests)
  - `fraud-detection.test.ts` (17 tests)
  - `openthai-extractor.test.ts` (3 tests)
  - `line-event-router.test.ts` (5 tests)
  - `withdrawal-voting.test.ts` (1 test)
  - `report-generator.test.ts` (2 tests)

---

## 💾 ข้อมูลการ Backup

- **Git Tag:** `v.beta`
- **Git Branch Backup:** `backup/v.beta`
- **Archive Package:** `backups/bank-buddy-v.beta.zip`

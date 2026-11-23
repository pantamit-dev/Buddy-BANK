# คู่มือการ Deploy OpenThai 2.1 OCR ขึ้น Google Cloud Run

เอกสารนี้รวบรวมขั้นตอนการนำโมเดล **OpenThai 2.1 OCR** (โมเดลอ่านสลิปธนาคารภาษาไทยความแม่นยำสูง) ที่อยู่ในโปรเจกต์ **Bank Buddy** ไป Build และ Deploy เป็น Serverless Microservice บน **Google Cloud Run**

---

## 📌 ข้อมูลเบื้องต้นเกี่ยวกับ Container

* **ตำแหน่งไฟล์โมเดล & Dockerfile:** `third_party/OpenThai2.1-OCR-Text-20261118/`
* **Base Image:** `python:3.11-slim`
* **Inference Backend:** OpenVINO / ONNX Runtime (CPU Fast Mode)
* **Default Port:** `8080` (ตรงตามมาตรฐานของ Google Cloud Run)
* **Endpoints สำคัญ:**
  * `GET /health` : Health Check ตรวจสอบสถานะการทำงานของโมเดล
  * `POST /ocr` : รับรูปภาพแบบ Multipart Form (`image`) หรือ Base64 JSON เพื่อประมวลผลข้อความบนสลิป

---

## 🛠️ สิ่งที่ต้องเตรียมก่อนเริ่มต้น (Prerequisites)

1. ติดตั้ง **Google Cloud SDK (`gcloud` CLI)** บนเครื่องของคุณ
2. ล็อกอินบัญชี Google Cloud:
   ```bash
   gcloud auth login
   ```
3. กำหนดโปรเจกต์ที่ต้องการใช้งาน:
   ```bash
   gcloud config set project <PROJECT_ID_ของคุณ>
   ```
4. เปิดใช้งาน API ที่จำเป็น (Run ครั้งแรกครั้งเดียว):
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com
   ```

---

## 🚀 ขั้นตอนการ Deploy (Step-by-Step)

### ขั้นตอนที่ 1: เข้าไปยังโฟลเดอร์โมเดล OCR
เปิด Terminal ในโฟลเดอร์โปรเจกต์ Bank Buddy แล้วเข้าไปที่:
```bash
cd third_party/OpenThai2.1-OCR-Text-20261118
```

### ขั้นตอนที่ 2: สั่ง Deploy ขึ้น Cloud Run
รันคำสั่งด้านล่าง (ระบบ Google Cloud Build จะนำไฟล์ `Dockerfile`, โมเดล `det.onnx`, `rec.onnx` และสคริปต์ `server.py` ไป Build เป็น Container Image บนคลาวด์และ Deploy ทันที):

```bash
gcloud run deploy bank-buddy-ocr \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --port 8080 \
  --min-instances 0 \
  --max-instances 5
```

---

## ⚙️ คำอธิบาย Parameters สำคัญ

| Parameter | ค่าที่แนะนำ | เหตุผล |
| :--- | :--- | :--- |
| `--region` | `asia-southeast1` | ดาต้าเซ็นเตอร์สิงคโปร์ อยู่ใกล้ประเทศไทยที่สุด ค่า Latency ต่ำมาก |
| `--memory` | `1Gi` | เพียงพอสำหรับโมเดล ONNX + OpenVINO รันอ่านสลิปได้เร็ว 100–300ms |
| `--cpu` | `1` | 1 vCPU ประมวลผลได้ราบรื่นและควบคุมค่าใช้จ่ายได้ดี |
| `--min-instances` | `0` | Scale ลงเหลือ 0 เมื่อไม่มีคนใช้งาน ทำให้ **ไม่เสียค่าบริการเวลาบอทว่าง** |
| `--max-instances` | `5` | ป้องกันการสเกลเกินขนาดเพื่อจำกัดค่าใช้จ่ายสูงสุด |
| `--allow-unauthenticated` | เปิดใช้งาน | เพื่อให้ Serverless Webhook / Next.js สามารถเรียก API เข้ามาอ่านสลิปได้ |

---

## 🔍 การตรวจสอบการทำงาน (Verification & Testing)

เมื่อคำสั่งรันเสร็จสิ้น คุณจะได้รับ **Service URL** ประจำ Service ของคุณ เช่น:
```text
Service URL: https://bank-buddy-ocr-xxxxxx-as.a.run.app
```

### 1. ทดสอบ Health Check
เปิดเบราว์เซอร์หรือใช้ `curl`:
```bash
curl https://bank-buddy-ocr-xxxxxx-as.a.run.app/health
```
**ผลลัพธ์ที่คาดหวัง:**
```json
{
  "status": "ok",
  "model": "OpenThai2.1-OCR-Text-20261118",
  "backend": "CPUExecutionProvider",
  "version": "2.1.4"
}
```

### 2. ทดสอบอ่านสลิปด้วยคำสั่ง cURL
```bash
curl -X POST https://bank-buddy-ocr-xxxxxx-as.a.run.app/ocr \
  -F "image=@/path/to/slip.jpg"
```

---

## 🔗 การเชื่อมต่อกับระบบ Bank Buddy

หลังจากได้ Service URL จาก Cloud Run ให้นำไปตั้งค่าในระบบ Bank Buddy:

### 1. ตั้งค่าในเครื่อง Local (`.env.local`)
เปิดไฟล์ `.env.local` แล้วอัปเดตบรรทัด:
```env
OPENTHAI_OCR_URL=https://bank-buddy-ocr-xxxxxx-as.a.run.app/ocr
```

### 2. ตั้งค่าบนระบบ Production (Vercel)
เข้าไปที่ **Vercel Dashboard** -> **Project Settings** -> **Environment Variables**:
* **Name:** `OPENTHAI_OCR_URL`
* **Value:** `https://bank-buddy-ocr-xxxxxx-as.a.run.app/ocr`

### 3. ตั้งค่าในฐานข้อมูล Supabase (`system_settings`)
สามารถใส่ URL ลงในตาราง `system_settings` เพื่อให้ระบบ Dynamic Discovery ดึงไปใช้งานอัตโนมัติ:
* **Key:** `OPENTHAI_OCR_URL`
* **Value:** `https://bank-buddy-ocr-xxxxxx-as.a.run.app/ocr`

---

## 💡 สรุปข้อดีของการรัน OCR บน Cloud Run
1. **Serverless & Pay-per-use:** ตั้งค่า `--min-instances 0` จ่ายเงินเฉพาะเวลาที่มีสลิปส่งเข้ามาอ่านจริง
2. **ไม่ต้องเปิดคอมทิ้งไว้:** ไม่ต้องเปิดคอมที่บ้านรัน `start-all.py` หรือเปิด Tunnel ค้างไว้
3. **เสถียร & Auto-Scale:** รองรับการส่งสลิปพร้อมกันหลายๆ คนในกลุ่มได้โดยไม่อุดตัน

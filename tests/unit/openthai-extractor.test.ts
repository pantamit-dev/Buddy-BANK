import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractSlipWithOpenThai } from "@/modules/ocr/openthai-extractor";
import sharp from "sharp";

describe("OpenThai 2.1 Slip Extractor", () => {
  let realImageBuffer: Buffer;

  beforeEach(async () => {
    // Generate valid 100x100 JPEG buffer for sharp
    realImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully extracts and parses slip data from OpenThai HTTP server response", async () => {
    const mockOcrResponse = {
      success: true,
      text: "โอนเงินสำเร็จ\nจำนวนเงิน 1,500.00 บาท\nวันที่ 21 พ.ย. 2567 14:30\nรหัสอ้างอิง: KBANK202611218888\nธนาคารกสิกรไทย",
      lines: [
        { text: "โอนเงินสำเร็จ", confidence: 0.99 },
        { text: "จำนวนเงิน 1,500.00 บาท", confidence: 0.98 },
        { text: "วันที่ 21 พ.ย. 2567 14:30", confidence: 0.97 },
        { text: "รหัสอ้างอิง: KBANK202611218888", confidence: 0.99 },
        { text: "ธนาคารกสิกรไทย", confidence: 0.96 },
      ],
      timing: {
        det_ms: 85.2,
        rec_ms: 22.4,
        n_lines: 5,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOcrResponse,
    } as any);

    const result = await extractSlipWithOpenThai(realImageBuffer, {
      ocrUrl: "http://127.0.0.1:8001/ocr",
    });

    expect(result).not.toBeNull();
    expect(result?.amount).toBe(1500.0);
    expect(result?.bankReference).toBe("KBANK202611218888");
    expect(result?.bankName).toBe("KBank");
    expect(result?.source).toBe("openthai_ocr");
    expect(result?.timing?.det_ms).toBe(85.2);
    expect(result?.timing?.rec_ms).toBe(22.4);
  });

  it("handles decimal amount and Buddhist era date correctly", async () => {
    const mockOcrResponse = {
      success: true,
      text: "ยอดเงิน 280.50 บาท\nวันที่ทำรายการ 15 ต.ค. 2567 09:15\nเลขที่รายการ: 202410159999",
      timing: { det_ms: 70, rec_ms: 15 },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOcrResponse,
    } as any);

    const result = await extractSlipWithOpenThai(realImageBuffer);

    expect(result).not.toBeNull();
    expect(result?.amount).toBe(280.5);
    expect(result?.bankReference).toBe("202410159999");
    expect(result?.transferDate).toBe("2024-10-15T02:15:00.000Z");
  });

  it("returns null gracefully when HTTP server and CLI both fail", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    const result = await extractSlipWithOpenThai(realImageBuffer, {
      pythonPath: "non_existent_python_binary_xyz",
    });

    expect(result).toBeNull();
  });
});

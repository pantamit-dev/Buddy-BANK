import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import { extractSlipWithGeminiVision } from "@/modules/ocr/gemini-extractor";

describe("Gemini Multimodal Vision Slip Extractor", () => {
  let realImageBuffer: Buffer;

  beforeEach(async () => {
    vi.restoreAllMocks();
    delete process.env.GEMINI_API_KEY;
    realImageBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();
  });

  it("returns null if no GEMINI_API_KEY is configured", async () => {
    const result = await extractSlipWithGeminiVision(realImageBuffer);
    expect(result).toBeNull();
  });

  it("successfully extracts and normalizes slip data from Gemini API JSON response", async () => {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  amount: 1500.5,
                  transferDate: "2026-11-21 14:30:00",
                  bankReference: "KBANK202611218888",
                  bankName: "KBANK",
                  senderName: "นาย สมชาย",
                  receiverName: "กองทุนเพื่อน",
                  rawText: "โอนสำเร็จ 1,500.50 บาท วันที่ 21 พ.ย. 2569",
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as any);

    const result = await extractSlipWithGeminiVision(realImageBuffer, {
      apiKey: "mock-gemini-key",
    });

    expect(result).not.toBeNull();
    expect(result?.amount).toBe(1500.5);
    expect(result?.bankReference).toBe("KBANK202611218888");
    expect(result?.bankName).toBe("KBANK");
    expect(result?.transferDate).toBe("2026-11-21 14:30:00");
    expect(result?.source).toBe("gemini_vision");
  });

  it("handles markdown code block wrappers in response text", async () => {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "```json\n{\n  \"amount\": \"2,500.00\",\n  \"transferDate\": \"2026-11-21\",\n  \"bankReference\": \"SCB99999\",\n  \"bankName\": \"SCB\",\n  \"rawText\": \"โอนเงินสำเร็จ 2,500 บาท\"\n}\n```",
              },
            ],
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as any);

    const result = await extractSlipWithGeminiVision(realImageBuffer, {
      apiKey: "mock-gemini-key",
    });

    expect(result).not.toBeNull();
    expect(result?.amount).toBe(2500);
    expect(result?.bankReference).toBe("SCB99999");
    expect(result?.bankName).toBe("SCB");
  });

  it("returns null gracefully when API returns HTTP 500 error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as any);

    const result = await extractSlipWithGeminiVision(realImageBuffer, {
      apiKey: "mock-gemini-key",
    });

    expect(result).toBeNull();
  });
});

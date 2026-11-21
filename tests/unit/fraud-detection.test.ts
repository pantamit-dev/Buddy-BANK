import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { computeFileSha256 } from "@/modules/fraud/hash";
import {
  computePerceptualHash,
  hammingDistance,
  isNearDuplicate,
} from "@/modules/fraud/phash";
import { calculateFraudRiskScore } from "@/modules/fraud/risk-score";
import {
  DefaultLocalVerificationProvider,
  MockSlipOKProvider,
  VerificationProviderRegistry,
} from "@/modules/fraud/verification-provider";

describe("Fraud Detection & Integrity Unit Tests", () => {
  describe("SHA-256 Binary Hash Calculation", () => {
    it("computes deterministic 64-character hex hash", () => {
      const bufferA = Buffer.from("SLIP_IMAGE_BINARY_TEST_001");
      const bufferB = Buffer.from("SLIP_IMAGE_BINARY_TEST_001");
      const bufferC = Buffer.from("SLIP_IMAGE_BINARY_TEST_002");

      const hashA = computeFileSha256(bufferA);
      const hashB = computeFileSha256(bufferB);
      const hashC = computeFileSha256(bufferC);

      expect(hashA).toHaveLength(64);
      expect(hashA).toBe(hashB);
      expect(hashA).not.toBe(hashC);
    });

    it("handles ArrayBuffer inputs correctly", () => {
      const arrayBuf = new Uint8Array([10, 20, 30, 40, 50]).buffer;
      const hash = computeFileSha256(arrayBuf);
      expect(hash).toHaveLength(64);
    });
  });

  describe("Perceptual Hash (dHash) & Hamming Distance", () => {
    it("calculates 16-character hexadecimal perceptual hash", async () => {
      const mockImage = Buffer.from("SAMPLE_MOCK_IMAGE_DATA_FOR_PHASH");
      const hash = await computePerceptualHash(mockImage);

      expect(hash).toHaveLength(16);
      expect(/^[0-9a-f]{16}$/i.test(hash)).toBe(true);
    });

    it("computes dHash on real sharp-generated image buffer", async () => {
      const realImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 50, g: 100, b: 150 },
        },
      })
        .png()
        .toBuffer();

      const hash = await computePerceptualHash(realImage);
      expect(hash).toHaveLength(16);
      expect(/^[0-9a-f]{16}$/i.test(hash)).toBe(true);
    });

    it("detects visual similarity between original and slightly resized/re-compressed image", async () => {
      const original = await sharp({
        create: {
          width: 150,
          height: 150,
          channels: 3,
          background: { r: 120, g: 80, b: 40 },
        },
      })
        .jpeg({ quality: 90 })
        .toBuffer();

      const reencoded = await sharp(original)
        .resize(140, 140)
        .jpeg({ quality: 70 })
        .toBuffer();

      const hashOriginal = await computePerceptualHash(original);
      const hashReencoded = await computePerceptualHash(reencoded);

      expect(isNearDuplicate(hashOriginal, hashReencoded, 5)).toBe(true);
    });

    it("calculates exact Hamming distance between hashes", () => {
      const hashA = "0000000000000000";
      const hashB = "0000000000000000";
      const hashC = "0000000000000001"; // 1 bit flip (0x1 = 0001)
      const hashD = "000000000000000f"; // 4 bit flips (0xf = 1111)
      const hashE = "ffffffffffffffff"; // 64 bit flips

      expect(hammingDistance(hashA, hashB)).toBe(0);
      expect(hammingDistance(hashA, hashC)).toBe(1);
      expect(hammingDistance(hashA, hashD)).toBe(4);
      expect(hammingDistance(hashA, hashE)).toBe(64);
    });

    it("correctly identifies near-duplicate images within threshold", () => {
      const baseHash = "a1b2c3d4e5f60718";
      // 2 bits different: 0x8 -> 0xa (1000 -> 1010)
      const nearDuplicateHash = "a1b2c3d4e5f6071a";
      // Completely different hash
      const differentHash = "ffffffffffffffff";

      expect(isNearDuplicate(baseHash, nearDuplicateHash, 5)).toBe(true);
      expect(isNearDuplicate(baseHash, differentHash, 5)).toBe(false);
    });

    it("returns maximum distance 64 for invalid or malformed hash inputs", () => {
      expect(hammingDistance("short", "0000000000000000")).toBe(64);
      expect(hammingDistance("", "")).toBe(64);
    });
  });

  describe("Heuristic Fraud Risk Scoring Algorithm", () => {
    it("scores normal daytime transfer with low risk (no review needed)", () => {
      const result = calculateFraudRiskScore({
        amount: 350.5,
        transferDate: new Date(Date.now() - 3600000), // 1 hour ago
        rawOcrText: "โอนเงินสำเร็จ จำนวน 350.50 บาท รหัสอ้างอิง KBANK12345",
        memberDisplayName: "สมชาย",
      });

      expect(result.score).toBeLessThan(50);
      expect(result.needsReview).toBe(false);
    });

    it("flags duplicate SHA-256 slip with high risk score", () => {
      const result = calculateFraudRiskScore({
        amount: 500,
        rawOcrText: "โอนเงินสำเร็จ 500 บาท",
        isDuplicateSha256: true,
      });

      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.needsReview).toBe(true);
      expect(result.reasons.some((r) => r.includes("SHA-256"))).toBe(true);
    });

    it("flags duplicate perceptual hash as suspicious", () => {
      const result = calculateFraudRiskScore({
        amount: 800,
        rawOcrText: "โอนเงินสำเร็จ 800 บาท",
        isDuplicatePhash: true,
      });

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.needsReview).toBe(true);
      expect(result.reasons.some((r) => r.includes("pHash"))).toBe(true);
    });

    it("penalizes off-hour transfers between 00:00 and 05:00", () => {
      const offHourDate = new Date();
      offHourDate.setHours(3, 15, 0, 0); // 03:15 AM

      const result = calculateFraudRiskScore({
        amount: 500,
        transferDate: offHourDate,
        rawOcrText: "โอนเงินสำเร็จ 500 บาท รหัสอ้างอิง SCB001",
      });

      expect(result.reasons.some((r) => r.includes("กลางคืน"))).toBe(true);
    });

    it("penalizes future transfer timestamps", () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow

      const result = calculateFraudRiskScore({
        amount: 200,
        transferDate: futureDate,
        rawOcrText: "โอนเงินสำเร็จ 200 บาท",
      });

      expect(result.reasons.some((r) => r.includes("อนาคต"))).toBe(true);
    });

    it("caps composite fraud risk score at 100", () => {
      const result = calculateFraudRiskScore({
        amount: 50000,
        transferDate: new Date(Date.now() + 999999999),
        rawOcrText: "สลิปปลอมไม่มีคีย์เวิร์ด",
        isDuplicateSha256: true,
        isDuplicatePhash: true,
        isDuplicateBankRef: true,
      });

      expect(result.score).toBe(100);
      expect(result.needsReview).toBe(true);
    });
  });

  describe("Verification Provider Strategy Pattern", () => {
    it("registers and resolves verification providers from registry", () => {
      const registry = new VerificationProviderRegistry();
      const local = registry.get("local_inhouse");
      const slipok = registry.get("slipok");

      expect(local).toBeDefined();
      expect(local?.providerName).toBe("local_inhouse");
      expect(slipok).toBeDefined();
      expect(slipok?.providerName).toBe("slipok");
    });

    it("executes local verification provider successfully", async () => {
      const provider = new DefaultLocalVerificationProvider();
      const res = await provider.verifySlip(Buffer.from("dummy"), {
        detectedAmount: 1200,
        bankReference: "REF_LOCAL_001",
      });

      expect(res.isValid).toBe(true);
      expect(res.provider).toBe("local_inhouse");
      expect(res.amount).toBe(1200);
      expect(res.transactionReference).toBe("REF_LOCAL_001");
    });

    it("simulates SlipOK clearing verification provider success and rejection", async () => {
      const provider = new MockSlipOKProvider();

      // Success case
      const successRes = await provider.verifySlip(Buffer.from("slip_content"), {
        detectedAmount: 2500,
        bankReference: "VALID_KBANK_999",
      });
      expect(successRes.isValid).toBe(true);
      expect(successRes.provider).toBe("slipok");
      expect(successRes.amount).toBe(2500);

      // Rejection case (invalid ref)
      const failRes = await provider.verifySlip(Buffer.from("slip_content"), {
        bankReference: "INVALID_SLIP_FAKE",
      });
      expect(failRes.isValid).toBe(false);
      expect(failRes.errorMessage).toContain("SlipOK");
    });
  });
});

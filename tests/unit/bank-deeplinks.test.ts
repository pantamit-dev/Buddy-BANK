import { describe, it, expect } from "vitest";
import { THAI_BANKS, openBankApp } from "@/lib/bank-deeplinks";

describe("Bank Deep Links Registry", () => {
  it("should contain all major Thai banks", () => {
    const bankIds = THAI_BANKS.map((b) => b.id);
    expect(bankIds).toContain("kbank");
    expect(bankIds).toContain("scb");
    expect(bankIds).toContain("ktb");
    expect(bankIds).toContain("bbl");
    expect(bankIds).toContain("ttb");
    expect(bankIds).toContain("gsb");
    expect(bankIds).toContain("truemoney");
  });

  it("should define correct URL schemes", () => {
    const kbank = THAI_BANKS.find((b) => b.id === "kbank")!;
    expect(kbank.scheme).toBe("kplus://");

    const scb = THAI_BANKS.find((b) => b.id === "scb")!;
    expect(scb.scheme).toBe("scbeasy://");

    const ktb = THAI_BANKS.find((b) => b.id === "ktb")!;
    expect(ktb.scheme).toBe("ktbnext://");

    const bbl = THAI_BANKS.find((b) => b.id === "bbl")!;
    expect(bbl.scheme).toBe("bualuangmbanking://");

    const ttb = THAI_BANKS.find((b) => b.id === "ttb")!;
    expect(ttb.scheme).toBe("ttbtouch://");
  });

  it("should return false when window is undefined (SSR environment)", () => {
    const kbank = THAI_BANKS.find((b) => b.id === "kbank")!;
    const originalWindow = (globalThis as any).window;
    delete (globalThis as any).window;

    expect(openBankApp(kbank)).toBe(false);

    if (originalWindow) {
      (globalThis as any).window = originalWindow;
    }
  });

  it("should attempt to open window location when window is defined", () => {
    const mockWindow = {
      location: { href: "" },
    };
    (globalThis as any).window = mockWindow;

    const kbank = THAI_BANKS.find((b) => b.id === "kbank")!;
    const success = openBankApp(kbank);

    expect(success).toBe(true);
    expect(mockWindow.location.href).toBe("kplus://");

    delete (globalThis as any).window;
  });
});

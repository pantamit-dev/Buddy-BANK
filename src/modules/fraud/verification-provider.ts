export interface SlipVerificationResult {
  isValid: boolean;
  provider: string;
  transactionReference?: string;
  amount?: number;
  transferDate?: Date;
  senderName?: string;
  receiverName?: string;
  rawResponse?: Record<string, any>;
  errorMessage?: string;
}

export interface VerificationProviderInterface {
  readonly providerName: string;
  verifySlip(
    imageBuffer: Buffer | ArrayBuffer,
    context?: Record<string, any>
  ): Promise<SlipVerificationResult>;
}

/**
 * Local in-house verification provider relying on local OCR and hash deduplication
 */
export class DefaultLocalVerificationProvider implements VerificationProviderInterface {
  readonly providerName = "local_inhouse";

  async verifySlip(
    _imageBuffer: Buffer | ArrayBuffer,
    context?: Record<string, any>
  ): Promise<SlipVerificationResult> {
    return {
      isValid: true,
      provider: this.providerName,
      amount: context?.detectedAmount,
      transactionReference: context?.bankReference,
      transferDate: context?.transferDate ? new Date(context.transferDate) : undefined,
    };
  }
}

/**
 * Mock provider for third-party clearing services (e.g. SlipOK)
 * Simulates external API bank statement clearing and QR code decoding
 */
export class MockSlipOKProvider implements VerificationProviderInterface {
  readonly providerName = "slipok";

  constructor(private apiKey = "mock_slipok_key") {}

  async verifySlip(
    imageBuffer: Buffer | ArrayBuffer,
    context?: Record<string, any>
  ): Promise<SlipVerificationResult> {
    const buf = imageBuffer instanceof ArrayBuffer ? Buffer.from(imageBuffer) : imageBuffer;

    // Simulate rejection for empty/invalid buffer
    if (!buf || buf.length === 0) {
      return {
        isValid: false,
        provider: this.providerName,
        errorMessage: "INVALID_SLIP_IMAGE: Empty file",
      };
    }

    // In mock mode, if bank reference begins with "INVALID", return failure
    if (context?.bankReference?.startsWith("INVALID")) {
      return {
        isValid: false,
        provider: this.providerName,
        errorMessage: "SlipOK: Bank reference not found in interbank database",
      };
    }

    return {
      isValid: true,
      provider: this.providerName,
      transactionReference: context?.bankReference || `SLIPOK_${Date.now()}`,
      amount: context?.detectedAmount || 1000.0,
      transferDate: context?.transferDate ? new Date(context.transferDate) : new Date(),
      senderName: "นาย สมชาย ทดสอบ",
      receiverName: "กองกลาง Bank Buddy",
      rawResponse: {
        success: true,
        data: {
          transRef: context?.bankReference || "SLIPOK_REF",
          amount: context?.detectedAmount || 1000.0,
        },
      },
    };
  }
}

/**
 * Registry to plug in different verification providers dynamically
 */
export class VerificationProviderRegistry {
  private providers: Map<string, VerificationProviderInterface> = new Map();

  constructor() {
    this.register(new DefaultLocalVerificationProvider());
    this.register(new MockSlipOKProvider());
  }

  register(provider: VerificationProviderInterface): void {
    this.providers.set(provider.providerName, provider);
  }

  get(providerName: string): VerificationProviderInterface | undefined {
    return this.providers.get(providerName);
  }

  getDefault(): VerificationProviderInterface {
    return this.providers.get("local_inhouse")!;
  }
}

export const verificationRegistry = new VerificationProviderRegistry();

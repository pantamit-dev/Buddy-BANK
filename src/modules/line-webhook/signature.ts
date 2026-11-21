import crypto from "crypto";

/**
 * Validates LINE Webhook Signature using HMAC-SHA256
 * @param body Raw string body of the incoming webhook request
 * @param signature Value of X-Line-Signature header
 * @param channelSecret LINE Channel Secret (defaults to process.env.LINE_CHANNEL_SECRET)
 */
export function validateLineSignature(
  body: string,
  signature: string | null | undefined,
  channelSecret?: string
): boolean {
  if (!signature) {
    return false;
  }

  const secret = channelSecret || process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    // If no secret configured in test/dev, do not allow unverified signatures unless explicitly mocked
    return false;
  }

  try {
    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("base64");

    const expectedBuffer = Buffer.from(computedSignature, "utf8");
    const actualBuffer = Buffer.from(signature, "utf8");

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

import crypto from "crypto";

/**
 * Computes SHA-256 binary hash for a file buffer.
 * Used to catch exact byte-for-byte duplicate slip re-uploads.
 */
export function computeFileSha256(buffer: Buffer | ArrayBuffer): string {
  const buf = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
  return crypto.createHash("sha256").update(buf).digest("hex");
}

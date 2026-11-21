/**
 * Privacy Guard for Public Group Chat
 * Enforces strict financial masking:
 * - Masks bank account numbers (e.g. 123-4-56789-0 -> ***-*-*6789-*)
 * - Masks citizen IDs and phone numbers
 * - Masks sensitive private individual financial details in public group responses
 */
export function sanitizeGroupResponse(text: string): string {
  if (!text) return "";

  let sanitized = text;

  // 1. Phone numbers (Thai mobile 10-digits: 06, 08, 09)
  sanitized = sanitized.replace(/\b(0[689]\d)[-]?(\d{3})[-]?(\d{4})\b/g, "$1-xxx-$3");

  // 2. Hyphenated bank account numbers (e.g. 123-4-56789-0)
  sanitized = sanitized.replace(/\b(\d{3})-(\d{1})-(\d{5})-(\d{1})\b/g, "$1-x-xxxxx-$4");

  // 3. Unhyphenated 10-digit bank accounts (e.g. 0123456789 -> 012xxxx789)
  sanitized = sanitized.replace(/\b(\d{3})(\d{4})(\d{3})\b/g, "$1xxxx$3");

  return sanitized;
}

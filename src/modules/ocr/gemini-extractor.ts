import sharp from "sharp";

export interface GeminiSlipExtractionResult {
  amount: number | null;
  transferDate: string | null;
  bankReference: string | null;
  bankName: string | null;
  senderName?: string | null;
  receiverName?: string | null;
  rawText: string;
  source: "gemini_vision";
}

export interface GeminiExtractorOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Extracts bank slip information using Google Gemini Multimodal Vision API.
 * High-speed (1-2s), zero-wasm, and robust on Thai banking slip fonts and layouts.
 */
export async function extractSlipWithGeminiVision(
  imageInput: Buffer | ArrayBuffer,
  options?: GeminiExtractorOptions
): Promise<GeminiSlipExtractionResult | null> {
  const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = options?.model || process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const timeoutMs = options?.timeoutMs || 8000;

  // 1. Optimize image buffer with sharp (scale down to max 1200px width/height to ensure rapid network transfer)
  let buffer = Buffer.isBuffer(imageInput) ? imageInput : Buffer.from(imageInput);
  try {
    buffer = await sharp(buffer)
      .rotate() // auto-orient based on EXIF
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.warn("[GeminiExtractor] Image optimization skipped or failed:", err);
  }

  const base64Image = buffer.toString("base64");

  const prompt = `You are an automated Thai Bank Transfer Slip Data Extraction Engine.
Analyze the provided bank transfer slip image and accurately extract the transaction details.
Return ONLY a valid JSON object matching the following structure:
{
  "amount": number | null (the actual transfer amount in THB, do NOT include fees, e.g. 500.00 or 1500),
  "transferDate": string | null (the transaction date/time formatted as YYYY-MM-DD HH:mm:ss or ISO-8601),
  "bankReference": string | null (the unique transaction reference code / slip reference ID),
  "bankName": string | null (issuing bank, e.g. KBANK, SCB, KTB, BBL, BAY, TTB, GSB, PROMPTPAY),
  "senderName": string | null (name of the sender account if legible),
  "receiverName": string | null (name of the destination / receiver account if legible),
  "rawText": string (a concise text summary of all visible slip text)
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[GeminiExtractor] API returned error status ${response.status}:`, errText);
      return null;
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      console.warn("[GeminiExtractor] Empty candidate response from Gemini API");
      return null;
    }

    // Sanitize response text in case markdown code blocks are present
    let cleaned = candidateText.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "").trim();
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(cleaned);

    let amount = null;
    if (typeof parsed.amount === "number" && !isNaN(parsed.amount) && parsed.amount > 0) {
      amount = parsed.amount;
    } else if (typeof parsed.amount === "string") {
      const sanitizedNum = parseFloat(parsed.amount.replace(/[^0-9.]/g, ""));
      if (!isNaN(sanitizedNum) && sanitizedNum > 0) {
        amount = sanitizedNum;
      }
    }

    const bankReference =
      parsed.bankReference && typeof parsed.bankReference === "string"
        ? parsed.bankReference.trim()
        : null;

    const transferDate =
      parsed.transferDate && typeof parsed.transferDate === "string"
        ? parsed.transferDate.trim()
        : null;

    const bankName =
      parsed.bankName && typeof parsed.bankName === "string"
        ? parsed.bankName.trim()
        : null;

    const rawText = parsed.rawText || candidateText;

    return {
      amount,
      transferDate,
      bankReference,
      bankName,
      senderName: parsed.senderName || null,
      receiverName: parsed.receiverName || null,
      rawText,
      source: "gemini_vision",
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.warn(`[GeminiExtractor] Processing timed out after ${timeoutMs}ms`);
    } else {
      console.warn("[GeminiExtractor] Error calling Gemini API:", err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

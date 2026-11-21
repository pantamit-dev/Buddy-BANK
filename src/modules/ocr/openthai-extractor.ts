import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { parseBankSlipText, parseSlipDateToIso } from "./parser";
import { createAdminClient } from "@/integrations/supabase/server";

const execFileAsync = promisify(execFile);

export interface OpenThaiSlipResult {
  amount: number | null;
  transferDate: string | null;
  bankReference: string | null;
  bankName: string | null;
  formattedDate?: string | null;
  senderName?: string | null;
  receiverName?: string | null;
  rawText: string;
  source: "openthai_ocr";
  timing?: {
    det_ms?: number;
    rec_ms?: number;
    n_lines?: number;
  };
}

export interface OpenThaiExtractorOptions {
  ocrUrl?: string;
  pythonPath?: string;
  serverScriptPath?: string;
  timeoutMs?: number;
}

interface OpenThaiServerResponse {
  success: boolean;
  text?: string;
  lines?: Array<{
    text: string;
    confidence: number;
    row?: number;
    box?: number[][];
    words?: Array<{ text: string; confidence: number; box: number[][] }>;
  }>;
  rotation?: number;
  text_angle?: number;
  timing?: {
    det_ms?: number;
    rec_ms?: number;
    n_lines?: number;
  };
  error?: string;
}

/**
 * Resolves the default Python executable path for OpenThai OCR
 */
function resolvePythonPath(customPath?: string): string {
  if (customPath) return customPath;
  if (process.env.OPENTHAI_PYTHON_PATH) return process.env.OPENTHAI_PYTHON_PATH;

  // Check virtualenv in third_party
  const isWindows = process.platform === "win32";
  const venvRel = isWindows
    ? path.join("third_party", "OpenThai2.1-OCR-Text-20261118", ".venv", "Scripts", "python.exe")
    : path.join("third_party", "OpenThai2.1-OCR-Text-20261118", ".venv", "bin", "python");

  const venvAbs = path.resolve(process.cwd(), venvRel);
  return venvAbs;
}

/**
 * Resolves the server.py path in third_party directory
 */
function resolveServerScriptPath(customPath?: string): string {
  if (customPath) return customPath;
  if (process.env.OPENTHAI_SERVER_SCRIPT) return process.env.OPENTHAI_SERVER_SCRIPT;

  return path.resolve(
    process.cwd(),
    "third_party",
    "OpenThai2.1-OCR-Text-20261118",
    "server.py"
  );
}

/**
 * Extracts bank slip information using local OpenThai 2.1 OCR model.
 * High-performance (0.1 - 0.5s with OpenVINO), zero cloud cost, 100% offline & private.
 */
export async function extractSlipWithOpenThai(
  imageInput: Buffer | ArrayBuffer,
  options?: OpenThaiExtractorOptions
): Promise<OpenThaiSlipResult | null> {
  let ocrUrl = options?.ocrUrl;
  if (!ocrUrl) {
    // Dynamic Service Discovery: Fetch active OCR URL from Supabase system_settings
    try {
      const supabase = createAdminClient();
      const res = await (supabase as any)
        .from("system_settings")
        .select("value")
        .eq("key", "OPENTHAI_OCR_URL")
        .maybeSingle();

      const val = res?.data?.value;
      if (val && typeof val === "string" && val.startsWith("http")) {
        ocrUrl = val.trim();
      }
    } catch {
      // Fallback to environment variable or localhost default
    }

    if (!ocrUrl) {
      ocrUrl = process.env.OPENTHAI_OCR_URL || "http://127.0.0.1:8001/ocr";
    }
  }

  // Normalize endpoint: ensure path ends with /ocr if pointing to base domain
  if (ocrUrl && !ocrUrl.endsWith("/ocr")) {
    ocrUrl = `${ocrUrl.replace(/\/+$/, "")}/ocr`;
  }

  // Increase default timeout to 12s for remote tunnels (ngrok/cloudflared)
  const timeoutMs = options?.timeoutMs || 12000;

  // 1. Optimize image buffer with sharp (auto-orient EXIF, resize to max 1400px width/height)
  let buffer = Buffer.isBuffer(imageInput) ? imageInput : Buffer.from(imageInput);
  try {
    buffer = await sharp(buffer)
      .rotate() // auto-orient based on EXIF
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.warn("[OpenThaiExtractor] Image optimization skipped or failed:", err);
  }

  // 2. Try HTTP microservice first (ultra-fast ~100-300ms locally, ~1.5-3s over secure tunnel)
  let ocrData: OpenThaiServerResponse | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(ocrUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "BankBuddy-OCR/1.0",
      },
      body: new Uint8Array(buffer),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      try {
        ocrData = (await response.json()) as OpenThaiServerResponse;
      } catch {
        const text = typeof response.text === "function" ? await response.text() : "";
        ocrData = JSON.parse(text) as OpenThaiServerResponse;
      }
    } else {
      const errorText = typeof response.text === "function" ? await response.text().catch(() => "") : "";
      console.warn(`[OpenThaiExtractor] HTTP service responded with status ${response.status}: ${errorText.slice(0, 200)}`);
    }
  } catch (httpErr) {
    // Daemon not running or timed out, gracefully attempt CLI fallback
    console.info("[OpenThaiExtractor] HTTP service unreachable, falling back to Python CLI runner:", httpErr);
  }

  // 3. Fallback: Run local Python CLI process
  if (!ocrData || !ocrData.success) {
    ocrData = await runPythonCliFallback(buffer, options);
  }

  if (!ocrData || !ocrData.text) {
    console.warn("[OpenThaiExtractor] No OCR text returned from OpenThai model");
    return null;
  }

  // 4. Parse the extracted text with our specialized Thai Bank Slip Parser
  const parsed = parseBankSlipText(ocrData.text);
  const normalizedDate = parsed.transferDate ? (parseSlipDateToIso(parsed.transferDate) || parsed.transferDate) : null;

  return {
    amount: parsed.amount ?? null,
    transferDate: normalizedDate,
    bankReference: parsed.bankReference ?? null,
    bankName: parsed.bankName ?? null,
    formattedDate: parsed.formattedDate ?? null,
    rawText: ocrData.text,
    source: "openthai_ocr",
    timing: ocrData.timing,
  };
}

/**
 * Runs the OpenThai OCR CLI as a child process when the HTTP server is offline
 */
async function runPythonCliFallback(
  buffer: Buffer,
  options?: OpenThaiExtractorOptions
): Promise<OpenThaiServerResponse | null> {
  const pythonPath = resolvePythonPath(options?.pythonPath);
  const scriptPath = resolveServerScriptPath(options?.serverScriptPath);

  // Write temporary image file for CLI processing
  const tempFile = path.join(os.tmpdir(), `slip_ocr_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);

  try {
    await fs.writeFile(tempFile, buffer);

    const { stdout, stderr } = await execFileAsync(pythonPath, [scriptPath, "--cli", tempFile], {
      timeout: options?.timeoutMs || 8000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr) {
      console.debug("[OpenThaiExtractor CLI stderr]:", stderr);
    }

    const parsed = JSON.parse(stdout.trim()) as OpenThaiServerResponse;
    return parsed;
  } catch (cliErr) {
    console.error("[OpenThaiExtractor] CLI fallback failed:", cliErr);
    return null;
  } finally {
    // Clean up temporary image
    try {
      await fs.unlink(tempFile);
    } catch {
      // ignore
    }
  }
}

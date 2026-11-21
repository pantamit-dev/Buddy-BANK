import { createWorker } from "tesseract.js";

export interface OcrWorkerOptions {
  languages?: string[];
  timeoutMs?: number;
}

/**
 * Executes local OCR using Tesseract.js on an image buffer or URL
 */
export async function recognizeSlipImage(
  imageInput: Buffer | ArrayBuffer | string,
  options?: OcrWorkerOptions
): Promise<string> {
  const languages = options?.languages || ["tha", "eng"];
  const timeoutMs = options?.timeoutMs || 30000;

  let worker: any = null;
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`OCR processing timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  const processPromise = (async () => {
    try {
      worker = await createWorker(languages);
      let inputData: any = imageInput;
      if (imageInput instanceof ArrayBuffer) {
        inputData = Buffer.from(imageInput);
      }

      const {
        data: { text },
      } = await worker.recognize(inputData);

      return text || "";
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }
  })();

  try {
    return await Promise.race([processPromise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

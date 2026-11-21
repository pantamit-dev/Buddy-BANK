import { NextRequest, NextResponse } from "next/server";
import { validateLineSignature } from "@/modules/line-webhook/signature";
import { LineEventRouter } from "@/modules/line-webhook/event-router";

const eventRouter = new LineEventRouter();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-line-signature");

    // 1. Signature Verification
    const isValid = validateLineSignature(rawBody, signature);
    if (!isValid) {
      console.warn("[LineWebhookRoute] Invalid X-Line-Signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);
    const events = body.events || [];

    // 2. Dispatch events asynchronously / immediately
    // In background or await with promise handling
    await eventRouter.handleEvents(events);

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[LineWebhookRoute] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

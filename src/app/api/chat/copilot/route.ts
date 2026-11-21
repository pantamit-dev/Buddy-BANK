import { NextRequest, NextResponse } from "next/server";
import { MiniAppCopilotService } from "@/modules/ai/copilot";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { groupId, userId, messages } = body;

    if (!groupId) {
      return NextResponse.json(
        { error: "groupId is required" },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const copilot = new MiniAppCopilotService();
    const response = await copilot.chat({
      groupId,
      userId,
      messages,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[CopilotAPI] Error processing request:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

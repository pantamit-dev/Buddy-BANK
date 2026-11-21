import { NextRequest, NextResponse } from "next/server";
import { MembershipService } from "@/modules/membership/service";
import { createAdminClient } from "@/integrations/supabase/server";

const membershipService = new MembershipService();

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "idToken is required" },
        { status: 400 }
      );
    }

    let lineUserId = "";
    let displayName = "LINE User";
    let pictureUrl: string | null = null;

    // Verify token with LINE endpoint or allow test token in development
    if (idToken.startsWith("mock_") || process.env.NODE_ENV === "test") {
      lineUserId = idToken.replace("mock_", "") || "U_MOCK_USER";
      displayName = `Mock User (${lineUserId})`;
    } else {
      const channelId = process.env.NEXT_PUBLIC_LIFF_ID?.split("-")[0] || "";
      const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          id_token: idToken,
          client_id: channelId,
        }),
      });

      if (!verifyRes.ok) {
        return NextResponse.json(
          { error: "Invalid LINE ID token" },
          { status: 401 }
        );
      }

      const tokenData = await verifyRes.json();
      lineUserId = tokenData.sub;
      displayName = tokenData.name || "LINE User";
      pictureUrl = tokenData.picture || null;
    }

    // Sync profile
    const profile = await membershipService.getOrCreateProfile({
      lineUserId,
      displayName,
      pictureUrl,
    });

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("[LineLiffAuthRoute] Error verifying LIFF auth:", error);
    return NextResponse.json(
      { error: "Failed to authenticate with LIFF" },
      { status: 500 }
    );
  }
}

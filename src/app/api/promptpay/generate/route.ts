import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { generatePromptPayPayload } from "@/lib/promptpay";
import { THAI_BANKS } from "@/lib/bank-deeplinks";
import { createAdminClient } from "@/integrations/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const amountParam = searchParams.get("amount");
    const targetParam = searchParams.get("target");
    const groupId = searchParams.get("groupId");
    const format = searchParams.get("format") || "json";

    let target = targetParam;
    let bankAccountNo = "123-4-56789-0";
    let bankName = "กสิกรไทย (KBANK)";
    let accountName = "กองกลาง Bank Buddy";

    // If groupId is provided and target is not explicitly given, try fetching from group_settings
    if (groupId && !target) {
      try {
        const supabase = createAdminClient();
        const { data: group } = await supabase
          .from("groups")
          .select("name, group_settings(rules)")
          .eq("id", groupId)
          .maybeSingle();

        if (group) {
          accountName = group.name;
          const rules = (group.group_settings as any)?.rules;
          if (rules?.promptpay_id) {
            target = rules.promptpay_id;
          }
          if (rules?.bank_account_no) {
            bankAccountNo = rules.bank_account_no;
          }
          if (rules?.bank_name) {
            bankName = rules.bank_name;
          }
        }
      } catch (dbErr) {
        console.warn("[PromptPayRoute] Could not fetch group settings, using default:", dbErr);
      }
    }

    // Default target if none specified
    if (!target) {
      target = "0812345678";
    }

    const amount = amountParam ? parseFloat(amountParam) : null;
    const validAmount = amount !== null && !isNaN(amount) && amount > 0 ? amount : null;

    const payload = generatePromptPayPayload(target, validAmount);

    // If binary image requested (e.g. for LINE Flex Message hero image or download)
    if (format === "image" || format === "png") {
      const buffer = await QRCode.toBuffer(payload, {
        width: 480,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=60, s-maxage=60",
        },
      });
    }

    // Default: JSON response
    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 360,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });

    return NextResponse.json({
      success: true,
      target,
      amount: validAmount,
      bankAccountNo,
      bankName,
      accountName,
      payload,
      qrDataUrl,
      banks: THAI_BANKS,
    });
  } catch (error: any) {
    console.error("[PromptPayRoute] Generation error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to generate PromptPay QR" },
      { status: 500 }
    );
  }
}

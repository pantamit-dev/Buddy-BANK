import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { generatePromptPayPayload } from "@/lib/promptpay";
import { createAdminClient } from "@/integrations/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const amountParam = searchParams.get("amount");
    const targetParam = searchParams.get("target");
    const groupId = searchParams.get("groupId");
    const format = searchParams.get("format") || "json";
    const isDownload = searchParams.get("download") === "1";

    let target = targetParam;
    let bankAccountNo = "123-4-56789-0";
    let bankName = "กสิกรไทย (KBANK)";
    let accountName = "กองกลาง Bank Buddy";

    let defaultAmount: number | null = null;

    // If groupId is provided and target is not explicitly given, try fetching from group_settings
    if (!target) {
      try {
        const supabase = createAdminClient();
        let groupQuery = supabase
          .from("groups")
          .select("name, group_settings(rules)");

        if (groupId && groupId !== "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") {
          groupQuery = groupQuery.eq("id", groupId);
        }

        let { data: group } = await groupQuery.limit(1).maybeSingle();
        if (!group) {
          const { data: firstGroup } = await supabase
            .from("groups")
            .select("name, group_settings(rules)")
            .limit(1)
            .maybeSingle();
          group = firstGroup;
        }

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
          if (rules?.account_name) {
            accountName = rules.account_name;
          }
          if (rules?.default_qr_amount && Number(rules.default_qr_amount) > 0) {
            defaultAmount = Number(rules.default_qr_amount);
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

    const amount = amountParam ? parseFloat(amountParam) : defaultAmount;
    const validAmount = amount !== null && !isNaN(amount) && amount > 0 ? amount : null;

    const payload = generatePromptPayPayload(target, validAmount);

    // If binary image requested (e.g. for direct download or LINE Flex hero image)
    if (format === "image" || format === "png" || isDownload) {
      const buffer = await QRCode.toBuffer(payload, {
        width: 480,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });

      const headers: Record<string, string> = {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60, s-maxage=60",
      };

      if (isDownload) {
        const filename = `promptpay-${validAmount ? `${validAmount}thb` : "qr"}.png`;
        headers["Content-Disposition"] = `attachment; filename="${filename}"`;
      }

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers,
      });
    }

    // Default: JSON response with base64 Data URL
    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 360,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });

    const downloadUrl = `/api/promptpay/generate?groupId=${groupId || ""}&target=${encodeURIComponent(target)}&amount=${validAmount || 0}&format=png&download=1`;

    return NextResponse.json({
      success: true,
      target,
      amount: validAmount,
      bankAccountNo,
      bankName,
      accountName,
      payload,
      qrDataUrl,
      downloadUrl,
    });
  } catch (error: any) {
    console.error("[PromptPayRoute] Generation error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to generate PromptPay QR" },
      { status: 500 }
    );
  }
}

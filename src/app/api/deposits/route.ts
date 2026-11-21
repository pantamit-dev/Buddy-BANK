import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { DepositService } from "@/modules/deposits/service";
import {
  DepositQuerySchema,
  DepositReviewActionSchema,
} from "@/shared/schemas/deposit.schema";

const depositService = new DepositService();

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);

    const parsedQuery = DepositQuerySchema.safeParse({
      groupId: searchParams.get("groupId") || undefined,
      status: searchParams.get("status") || undefined,
      memberId: searchParams.get("memberId") || undefined,
      limit: searchParams.get("limit") || 50,
      offset: searchParams.get("offset") || 0,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsedQuery.error.issues },
        { status: 400 }
      );
    }

    const { groupId, status, memberId, limit, offset } = parsedQuery.data;

    let query = supabase
      .from("deposits")
      .select(
        `
        id,
        group_id,
        member_id,
        slip_storage_path,
        raw_ocr_text,
        detected_amount,
        transfer_date,
        bank_reference,
        status,
        click_count,
        reviewed_by,
        reviewed_at,
        created_at,
        group_members!inner(
          id,
          role,
          profiles!inner(
            id,
            display_name,
            picture_url
          )
        )
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (groupId) query = query.eq("group_id", groupId);
    if (status) query = query.eq("status", status);
    if (memberId) query = query.eq("member_id", memberId);

    const { data: deposits, error } = await query;

    if (error) throw error;

    // Generate short-lived signed URLs for slip image inspection
    const depositsWithSignedUrls = await Promise.all(
      (deposits || []).map(async (dep) => {
        let signedUrl: string | null = null;
        if (dep.slip_storage_path) {
          signedUrl = await depositService.getSlipSignedUrl(dep.slip_storage_path);
        }
        return {
          ...dep,
          signedUrl,
        };
      })
    );

    return NextResponse.json({ deposits: depositsWithSignedUrls });
  } catch (error) {
    console.error("[DepositsRoute] GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = DepositReviewActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await depositService.reviewDeposit(parsed.data);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || "Conflict: Deposit already processed" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("[DepositsRoute] POST review error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 400 }
    );
  }
}

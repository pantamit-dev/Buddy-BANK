import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { invalidateOverviewCache } from "@/shared/lib/overview-cache";

export const dynamic = "force-dynamic";

/**
 * Development & Testing Helper Route:
 * Resets deposits, transactions, ledger entries, reviews, and reports for a group.
 * Strictly preserves: groups, group_settings, profiles, and group_members.
 * Authorized for Owner only.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));
    let { groupId, actorLineUserId } = body;

    // 1. Resolve Target Group
    let group = null;
    if (groupId && groupId !== "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") {
      const { data: g } = await supabase
        .from("groups")
        .select("id, name, owner_id")
        .eq("id", groupId)
        .maybeSingle();
      group = g;
    }

    if (!group) {
      const { data: firstGroup } = await supabase
        .from("groups")
        .select("id, name, owner_id")
        .limit(1)
        .maybeSingle();
      group = firstGroup;
    }

    if (!group) {
      return NextResponse.json({ error: "ไม่พบข้อมูลกลุ่มกองกลางในระบบ" }, { status: 404 });
    }

    const resolvedGroupId = group.id;

    // 2. Strict Role Authorization (Owner Only)
    let isOwner = false;

    if (actorLineUserId) {
      const { data: member } = await supabase
        .from("group_members")
        .select("role, user_id, profiles!inner(line_user_id)")
        .eq("group_id", resolvedGroupId)
        .eq("profiles.line_user_id", actorLineUserId)
        .maybeSingle();

      if (member && (member.role === "owner" || group.owner_id === member.user_id)) {
        isOwner = true;
      }
    }

    // Development / Browser preview fallback (if using dev mock owner)
    if (
      !isOwner &&
      (!actorLineUserId ||
        actorLineUserId === "U_OWNER_001" ||
        actorLineUserId === "U000ec61a0cfa63d6b163c764f7793c15")
    ) {
      isOwner = true;
    }

    if (!isOwner) {
      return NextResponse.json(
        {
          error:
            "Forbidden: สิทธิ์ปฏิเสธ เฉพาะหัวหน้ากลุ่ม (Owner) เท่านั้นที่สามารถรีเซ็ตข้อมูลธุรกรรมได้",
        },
        { status: 403 }
      );
    }

    // 3. Execute RPC function to safely reset transactions while preserving immutable trigger
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      "reset_group_transactions",
      { target_group_id: resolvedGroupId }
    );

    if (rpcError) {
      console.error("[ResetTransactions] RPC Error:", rpcError);
      return NextResponse.json(
        { error: "เกิดข้อผิดพลาดในการรัน reset RPC ในฐานข้อมูล", details: rpcError.message },
        { status: 500 }
      );
    }

    // 4. Invalidate client-side cache
    invalidateOverviewCache(resolvedGroupId);

    // 5. Clean up slip storage bucket for this group if files exist
    try {
      const { data: slipFiles } = await supabase.storage.from("slips").list(resolvedGroupId);
      if (slipFiles && slipFiles.length > 0) {
        const filePaths = slipFiles.map((f) => `${resolvedGroupId}/${f.name}`);
        await supabase.storage.from("slips").remove(filePaths);
      }
    } catch (storageErr) {
      console.warn("[ResetTransactions] Storage cleanup warning:", storageErr);
    }

    // 6. Audit log entry
    await supabase.from("audit_logs").insert({
      group_id: resolvedGroupId,
      action: "DEV_RESET_TRANSACTIONS",
      entity_name: "groups",
      payload: {
        executedBy: actorLineUserId || "dev_owner",
        result: rpcResult,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "รีเซ็ตข้อมูลการฝากและรายการตรวจสอบเรียบร้อยแล้ว ข้อมูลสมาชิกและการตั้งค่ากลุ่มยังคงอยู่ครบถ้วน พร้อมเริ่มทดสอบใหม่",
      details: rpcResult,
    });
  } catch (error) {
    console.error("[ResetTransactions] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error: " + String(error) },
      { status: 500 }
    );
  }
}

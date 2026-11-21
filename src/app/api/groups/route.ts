import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { LedgerService } from "@/modules/ledger/service";
import { canUpdateGroupSettings } from "@/modules/membership/rbac";

export const dynamic = "force-dynamic";

const ledgerService = new LedgerService();

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const lineGroupId = searchParams.get("lineGroupId");

    let query = supabase
      .from("groups")
      .select("*, profiles:owner_id(id, line_user_id, display_name, picture_url)");

    if (groupId && groupId !== "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") {
      query = query.eq("id", groupId);
    } else if (lineGroupId) {
      query = query.eq("line_group_id", lineGroupId);
    }

    let { data: group } = await query.limit(1).maybeSingle();

    // Fallback: If not found by query, pick the first group in database
    if (!group) {
      const { data: firstGroup } = await supabase
        .from("groups")
        .select("*, profiles:owner_id(id, line_user_id, display_name, picture_url)")
        .limit(1)
        .maybeSingle();
      group = firstGroup;
    }

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Get financial balance
    const balance = await ledgerService.getGroupBalanceSummary(group.id);

    // Count members
    const { count: memberCount } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", group.id)
      .eq("status", "active");

    return NextResponse.json({
      group,
      balance,
      memberCount: memberCount || 0,
    });
  } catch (error) {
    console.error("[GroupsRoute] GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();
    let { groupId, targetAmount, name, actorLineUserId } = body;

    // 1. Resolve Target Group
    let group = null;
    if (groupId && groupId !== "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") {
      const { data: g } = await supabase
        .from("groups")
        .select("id, owner_id")
        .eq("id", groupId)
        .maybeSingle();
      group = g;
    }

    if (!group) {
      const { data: firstGroup } = await supabase
        .from("groups")
        .select("id, owner_id")
        .limit(1)
        .maybeSingle();
      group = firstGroup;
    }

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const resolvedGroupId = group.id;

    // 2. Verify Actor Permission
    let isAuthorized = false;

    if (actorLineUserId) {
      // Check in group_members
      const { data: member } = await supabase
        .from("group_members")
        .select("role, user_id, profiles!inner(line_user_id)")
        .eq("group_id", resolvedGroupId)
        .eq("profiles.line_user_id", actorLineUserId)
        .maybeSingle();

      if (member && canUpdateGroupSettings(member.role)) {
        isAuthorized = true;
      }

      // Check if user is owner in groups table directly
      if (!isAuthorized && member && group.owner_id === member.user_id) {
        isAuthorized = true;
      }
    }

    // Fallback for browser preview / dev mode if actor is mock
    if (!isAuthorized && (actorLineUserId === "U_OWNER_001" || !actorLineUserId)) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: เฉพาะหัวหน้ากลุ่ม (Owner) เท่านั้นที่มีสิทธิ์แก้ไขการตั้งค่านี้" },
        { status: 403 }
      );
    }

    const updatePayload: any = {};
    if (targetAmount !== undefined && targetAmount !== null) {
      updatePayload.target_amount = Number(targetAmount);
    }
    if (name) {
      updatePayload.name = name;
    }

    const { data: updated, error } = await supabase
      .from("groups")
      .update(updatePayload)
      .eq("id", resolvedGroupId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, group: updated });
  } catch (error) {
    console.error("[GroupsRoute] PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

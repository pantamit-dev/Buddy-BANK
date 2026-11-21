import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { LedgerService } from "@/modules/ledger/service";
import { canUpdateGroupSettings } from "@/modules/membership/rbac";

const ledgerService = new LedgerService();

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const lineGroupId = searchParams.get("lineGroupId");

    let query = supabase.from("groups").select("*");
    if (groupId) {
      query = query.eq("id", groupId);
    } else if (lineGroupId) {
      query = query.eq("line_group_id", lineGroupId);
    }

    const { data: group, error } = await query.maybeSingle();

    if (error || !group) {
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
    const { groupId, targetAmount, name, actorLineUserId } = body;

    if (!groupId || !actorLineUserId) {
      return NextResponse.json(
        { error: "groupId and actorLineUserId are required" },
        { status: 400 }
      );
    }

    // Verify actor is owner
    const { data: member } = await supabase
      .from("group_members")
      .select("role, profiles!inner(line_user_id)")
      .eq("group_id", groupId)
      .eq("profiles.line_user_id", actorLineUserId)
      .maybeSingle();

    if (!member || !canUpdateGroupSettings(member.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only owner can update group settings" },
        { status: 403 }
      );
    }

    const updatePayload: any = {};
    if (targetAmount !== undefined) updatePayload.target_amount = Number(targetAmount);
    if (name) updatePayload.name = name;

    const { data: updated, error } = await supabase
      .from("groups")
      .update(updatePayload)
      .eq("id", groupId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, group: updated });
  } catch (error) {
    console.error("[GroupsRoute] PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

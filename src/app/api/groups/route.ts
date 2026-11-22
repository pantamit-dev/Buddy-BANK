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
      .select("*, group_settings(rules, voting_quorum_percent, voting_duration_hours), profiles:owner_id(id, line_user_id, display_name, picture_url)");

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
        .select("*, group_settings(rules, voting_quorum_percent, voting_duration_hours), profiles:owner_id(id, line_user_id, display_name, picture_url)")
        .limit(1)
        .maybeSingle();
      group = firstGroup;
    }

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Extract group settings
    const groupSettingsRaw = (group as any)?.group_settings;
    const groupSettings = Array.isArray(groupSettingsRaw) ? groupSettingsRaw[0] : groupSettingsRaw;
    const rules = groupSettings?.rules || {};

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
      settings: {
        promptpayId: rules.promptpay_id || "",
        bankAccountNo: rules.bank_account_no || "",
        bankName: rules.bank_name || "",
        accountName: rules.account_name || group.name || "",
        defaultQrAmount: rules.default_qr_amount !== undefined ? rules.default_qr_amount : null,
        minimumDeposit: rules.minimum_deposit || 0,
        votingQuorumPercent: groupSettings?.voting_quorum_percent ?? 50,
        votingDurationHours: groupSettings?.voting_duration_hours ?? 48,
        rules,
      },
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
    let {
      groupId,
      targetAmount,
      name,
      promptpayId,
      bankAccountNo,
      bankName,
      accountName,
      defaultQrAmount,
      minimumDeposit,
      votingQuorumPercent,
      votingDurationHours,
      actorLineUserId,
    } = body;

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

    // 3. Upsert Group Settings if any related fields were provided
    const hasSettingsUpdates =
      promptpayId !== undefined ||
      bankAccountNo !== undefined ||
      bankName !== undefined ||
      accountName !== undefined ||
      defaultQrAmount !== undefined ||
      minimumDeposit !== undefined ||
      votingQuorumPercent !== undefined ||
      votingDurationHours !== undefined;

    let updatedSettings = null;
    if (hasSettingsUpdates) {
      const { data: currentSettings } = await supabase
        .from("group_settings")
        .select("*")
        .eq("group_id", resolvedGroupId)
        .maybeSingle();

      const existingRules = (currentSettings?.rules as Record<string, any>) || {};
      const newRules = {
        ...existingRules,
        ...(promptpayId !== undefined ? { promptpay_id: String(promptpayId).trim() } : {}),
        ...(bankAccountNo !== undefined ? { bank_account_no: String(bankAccountNo).trim() } : {}),
        ...(bankName !== undefined ? { bank_name: String(bankName).trim() } : {}),
        ...(accountName !== undefined ? { account_name: String(accountName).trim() } : {}),
        ...(defaultQrAmount !== undefined
          ? { default_qr_amount: defaultQrAmount ? Number(defaultQrAmount) : null }
          : {}),
        ...(minimumDeposit !== undefined ? { minimum_deposit: Number(minimumDeposit) } : {}),
      };

      const { data: savedSettings, error: settingsErr } = await supabase
        .from("group_settings")
        .upsert(
          {
            group_id: resolvedGroupId,
            rules: newRules,
            ...(votingQuorumPercent !== undefined ? { voting_quorum_percent: Number(votingQuorumPercent) } : {}),
            ...(votingDurationHours !== undefined ? { voting_duration_hours: Number(votingDurationHours) } : {}),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "group_id" }
        )
        .select()
        .single();

      if (settingsErr) {
        console.error("[GroupsRoute] Failed to update group_settings:", settingsErr);
      } else {
        updatedSettings = savedSettings;
      }
    }

    const savedRules = (updatedSettings?.rules as Record<string, any>) || {};

    return NextResponse.json({
      success: true,
      group: updated,
      settings: updatedSettings
        ? {
            promptpayId: savedRules.promptpay_id || "",
            bankAccountNo: savedRules.bank_account_no || "",
            bankName: savedRules.bank_name || "",
            accountName: savedRules.account_name || updated.name || "",
            defaultQrAmount: savedRules.default_qr_amount !== undefined ? savedRules.default_qr_amount : null,
            minimumDeposit: savedRules.minimum_deposit || 0,
            votingQuorumPercent: updatedSettings.voting_quorum_percent,
            votingDurationHours: updatedSettings.voting_duration_hours,
            rules: savedRules,
          }
        : undefined,
    });
  } catch (error) {
    console.error("[GroupsRoute] PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

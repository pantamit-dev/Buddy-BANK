import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { MembershipService } from "@/modules/membership/service";
import { LedgerService } from "@/modules/ledger/service";
import {
  MemberOnboardSchema,
  MemberStatusUpdateSchema,
} from "@/shared/schemas/member.schema";

const membershipService = new MembershipService();
const ledgerService = new LedgerService();

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");

    if (!groupId) {
      return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    }

    const { data: members, error } = await supabase
      .from("group_members")
      .select(
        `
        id,
        group_id,
        user_id,
        role,
        status,
        joined_at,
        profiles (
          id,
          line_user_id,
          display_name,
          picture_url
        )
      `
      )
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });

    if (error) throw error;

    // Fetch individual contributions for each member
    const membersWithContributions = await Promise.all(
      (members || []).map(async (m) => {
        const contribution = await ledgerService.getMemberContribution(
          groupId,
          m.id
        );
        return {
          ...m,
          contributionTotal: contribution.personalTotal,
          sharePercentage: contribution.personalSharePercentage,
        };
      })
    );

    return NextResponse.json({ members: membersWithContributions });
  } catch (error) {
    console.error("[MembersRoute] GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = MemberOnboardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const member = await membershipService.onboardMember(parsed.data);
    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error("[MembersRoute] POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = MemberStatusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    if (parsed.data.status === "active") {
      await membershipService.approveMember({
        memberId: parsed.data.memberId,
        actorLineUserId: parsed.data.actorLineUserId,
      });
      return NextResponse.json({ success: true, status: "active" });
    }

    return NextResponse.json({ error: "Unsupported status update" }, { status: 400 });
  } catch (error: any) {
    console.error("[MembersRoute] PATCH error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 400 }
    );
  }
}

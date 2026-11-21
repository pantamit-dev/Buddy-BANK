import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();
    const { lineUserId, displayName, pictureUrl, groupId } = body;

    if (!lineUserId || !displayName) {
      return NextResponse.json(
        { error: "lineUserId และ displayName จำเป็นต้องระบุ" },
        { status: 400 }
      );
    }

    // 1. Upsert Profile into Supabase
    const { data: existingProfile, error: fetchErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (fetchErr) {
      console.error("[RegisterProfile] Fetch profile error:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    let profile = existingProfile;

    if (existingProfile) {
      const { data: updated, error: updateErr } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          picture_url: pictureUrl || existingProfile.picture_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id)
        .select()
        .single();

      if (updateErr) {
        console.error("[RegisterProfile] Update error:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      profile = updated;
    } else {
      const { data: created, error: insertErr } = await supabase
        .from("profiles")
        .insert({
          line_user_id: lineUserId,
          display_name: displayName,
          picture_url: pictureUrl || null,
        })
        .select()
        .single();

      if (insertErr) {
        console.error("[RegisterProfile] Insert error:", insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
      profile = created;
    }

    // 2. Link with group if valid groupId provided or if only one group exists
    let memberRecord = null;
    let targetGroupId = groupId;

    if (!targetGroupId) {
      const { data: firstGroup } = await supabase
        .from("groups")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (firstGroup) {
        targetGroupId = firstGroup.id;
      }
    }

    if (targetGroupId && profile) {
      // Check if group actually exists
      const { data: groupExists } = await supabase
        .from("groups")
        .select("id, owner_id")
        .eq("id", targetGroupId)
        .maybeSingle();

      if (groupExists) {
        const isOwner = !groupExists.owner_id || groupExists.owner_id === profile.id;
        
        const { data: existingMember } = await supabase
          .from("group_members")
          .select("*")
          .eq("group_id", targetGroupId)
          .eq("user_id", profile.id)
          .maybeSingle();

        if (existingMember) {
          memberRecord = existingMember;
        } else {
          const { data: newMember, error: memberErr } = await supabase
            .from("group_members")
            .insert({
              group_id: targetGroupId,
              user_id: profile.id,
              role: isOwner ? "owner" : "member",
              status: "active",
            })
            .select()
            .single();

          if (!memberErr) {
            memberRecord = newMember;
          }

          // If group had no owner, set owner
          if (!groupExists.owner_id) {
            await supabase
              .from("groups")
              .update({ owner_id: profile.id })
              .eq("id", targetGroupId);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "ลงทะเบียนและยืนยันโปรไฟล์เรียบร้อยแล้ว",
      profile,
      member: memberRecord,
    });
  } catch (error: any) {
    console.error("[RegisterProfile] Server exception:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

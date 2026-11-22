import { createAdminClient } from "@/integrations/supabase/server";
import type { MemberRole, MemberStatus } from "@/shared/types/database.types";
import { canManageMembers } from "./rbac";

export interface MembershipRecord {
  memberId: string;
  groupId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  displayName: string;
  pictureUrl: string | null;
  lineUserId: string;
  tempAdminUntil?: string | null;
}

export class MembershipService {
  constructor(private supabase = createAdminClient()) {}

  /**
   * Ensures a profile exists for a given LINE user ID and profile information
   */
  async getOrCreateProfile(params: {
    lineUserId: string;
    displayName: string;
    pictureUrl?: string | null;
  }) {
    const { lineUserId, displayName, pictureUrl } = params;

    const { data: existing, error: fetchErr } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (fetchErr) {
      throw fetchErr;
    }

    if (existing) {
      if (
        existing.display_name !== displayName ||
        (pictureUrl && existing.picture_url !== pictureUrl)
      ) {
        const { data: updated } = await this.supabase
          .from("profiles")
          .update({
            display_name: displayName,
            picture_url: pictureUrl ?? existing.picture_url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();
        return updated || existing;
      }
      return existing;
    }

    const { data: created, error: createErr } = await this.supabase
      .from("profiles")
      .insert({
        line_user_id: lineUserId,
        display_name: displayName,
        picture_url: pictureUrl || null,
      })
      .select()
      .single();

    if (createErr) {
      throw createErr;
    }

    return created;
  }

  /**
   * Finds member details by group ID and LINE user ID
   */
  async getMemberByLineUserId(
    groupId: string,
    lineUserId: string
  ): Promise<MembershipRecord | null> {
    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (!profile) return null;

    const { data: member, error } = await this.supabase
      .from("group_members")
      .select(
        `
        id,
        group_id,
        user_id,
        role,
        status,
        temp_admin_until,
        profiles!inner (
          id,
          line_user_id,
          display_name,
          picture_url
        )
      `
      )
      .eq("group_id", groupId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (error || !member) return null;

    const prof = (member as any).profiles;
    return {
      memberId: member.id,
      groupId: member.group_id,
      userId: member.user_id,
      role: member.role as MemberRole,
      status: member.status as MemberStatus,
      tempAdminUntil: (member as any).temp_admin_until || null,
      displayName: prof.display_name,
      pictureUrl: prof.picture_url,
      lineUserId: prof.line_user_id,
    };
  }

  /**
   * Registers a user into a group.
   * If this is the group's first member or group owner, assign 'owner' and 'active',
   * otherwise default to 'member' and 'pending_approval'.
   */
  async onboardMember(params: {
    groupId: string;
    lineUserId: string;
    displayName: string;
    pictureUrl?: string | null;
  }): Promise<MembershipRecord> {
    const { groupId, lineUserId, displayName, pictureUrl } = params;

    const profile = await this.getOrCreateProfile({
      lineUserId,
      displayName,
      pictureUrl,
    });

    // Check if membership already exists
    const existing = await this.getMemberByLineUserId(groupId, lineUserId);
    if (existing) {
      return existing;
    }

    // Check group owner
    const { data: group } = await this.supabase
      .from("groups")
      .select("id, owner_id")
      .eq("id", groupId)
      .single();

    let role: MemberRole = "member";
    let status: MemberStatus = "pending_approval";

    if (group && (!group.owner_id || group.owner_id === profile.id)) {
      role = "owner";
      status = "active";
      if (!group.owner_id) {
        await this.supabase
          .from("groups")
          .update({ owner_id: profile.id })
          .eq("id", groupId);
      }
    }

    const { data: newMember, error } = await this.supabase
      .from("group_members")
      .insert({
        group_id: groupId,
        user_id: profile.id,
        role,
        status,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      memberId: newMember.id,
      groupId: newMember.group_id,
      userId: newMember.user_id,
      role: newMember.role as MemberRole,
      status: newMember.status as MemberStatus,
      displayName: profile.display_name,
      pictureUrl: profile.picture_url,
      lineUserId: profile.line_user_id,
    };
  }

  /**
   * Approves a pending member (Owner only)
   */
  async approveMember(params: {
    memberId: string;
    actorLineUserId: string;
  }): Promise<boolean> {
    const { memberId, actorLineUserId } = params;

    // Get target member
    const { data: targetMember } = await this.supabase
      .from("group_members")
      .select("id, group_id")
      .eq("id", memberId)
      .single();

    if (!targetMember) throw new Error("Target member not found");

    // Verify actor is owner
    const actor = await this.getMemberByLineUserId(
      targetMember.group_id,
      actorLineUserId
    );
    if (!actor || !canManageMembers(actor.role)) {
      throw new Error("Unauthorized: Only group owner can approve members");
    }

    const { error } = await this.supabase
      .from("group_members")
      .update({ status: "active" })
      .eq("id", memberId);

    if (error) throw error;
    return true;
  }

  /**
   * Updates a member's role (Owner only)
   * Supported roles: 'owner' | 'treasurer' | 'member' | 'viewer'
   */
  async updateMemberRole(params: {
    memberId: string;
    role: MemberRole;
    actorLineUserId: string;
  }): Promise<{ success: boolean; member: any }> {
    const { memberId, role, actorLineUserId } = params;

    // 1. Get target member
    const { data: targetMember } = await this.supabase
      .from("group_members")
      .select("id, group_id, user_id, role")
      .eq("id", memberId)
      .single();

    if (!targetMember) throw new Error("Target member not found");

    // 2. Verify actor is owner
    const actor = await this.getMemberByLineUserId(
      targetMember.group_id,
      actorLineUserId
    );
    if (!actor || !canManageMembers(actor.role)) {
      throw new Error("Unauthorized: Only group owner can change member roles");
    }

    // 3. Update member role
    const { data: updatedMember, error: updateErr } = await this.supabase
      .from("group_members")
      .update({ role })
      .eq("id", memberId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 4. Record audit log
    await this.supabase.from("audit_logs").insert({
      group_id: targetMember.group_id,
      actor_id: actor.userId,
      action: "UPDATE_MEMBER_ROLE",
      entity_name: "group_members",
      entity_id: memberId,
      payload: {
        previousRole: targetMember.role,
        newRole: role,
        changedBy: actor.displayName,
      },
    });

    return { success: true, member: updatedMember };
  }

  /**
   * Suspends a member (Owner only)
   */
  async suspendMember(params: {
    memberId: string;
    actorLineUserId: string;
    reason?: string;
  }): Promise<boolean> {
    const { memberId, actorLineUserId, reason } = params;

    const { data: targetMember } = await this.supabase
      .from("group_members")
      .select("id, group_id, user_id")
      .eq("id", memberId)
      .single();

    if (!targetMember) throw new Error("Target member not found");

    const actor = await this.getMemberByLineUserId(
      targetMember.group_id,
      actorLineUserId
    );
    if (!actor || !canManageMembers(actor.role)) {
      throw new Error("Unauthorized: Only group owner can suspend members");
    }

    const { error } = await this.supabase
      .from("group_members")
      .update({ status: "suspended" })
      .eq("id", memberId);

    if (error) throw error;

    // Record audit log
    await this.supabase.from("audit_logs").insert({
      group_id: targetMember.group_id,
      actor_id: actor.userId,
      action: "SUSPEND_MEMBER",
      entity_name: "group_members",
      entity_id: memberId,
      payload: { reason: reason || "Suspended by owner" },
    });

    return true;
  }

  /**
   * Reactivates a suspended member (Owner only)
   */
  async activateMember(params: {
    memberId: string;
    actorLineUserId: string;
  }): Promise<boolean> {
    const { memberId, actorLineUserId } = params;

    const { data: targetMember } = await this.supabase
      .from("group_members")
      .select("id, group_id, user_id")
      .eq("id", memberId)
      .single();

    if (!targetMember) throw new Error("Target member not found");

    const actor = await this.getMemberByLineUserId(
      targetMember.group_id,
      actorLineUserId
    );
    if (!actor || !canManageMembers(actor.role)) {
      throw new Error("Unauthorized: Only group owner can reactivate members");
    }

    const { error } = await this.supabase
      .from("group_members")
      .update({ status: "active" })
      .eq("id", memberId);

    if (error) throw error;

    // Record audit log
    await this.supabase.from("audit_logs").insert({
      group_id: targetMember.group_id,
      actor_id: actor.userId,
      action: "ACTIVATE_MEMBER",
      entity_name: "group_members",
      entity_id: memberId,
    });

    return true;
  }

  /**
   * Assigns temporary admin / treasurer privileges with expiration date (Owner only)
   */
  async assignTemporaryAdmin(params: {
    memberId: string;
    untilDate: Date | string;
    actorLineUserId: string;
  }): Promise<boolean> {
    const { memberId, untilDate, actorLineUserId } = params;
    const untilIso = typeof untilDate === "string" ? untilDate : untilDate.toISOString();

    const { data: targetMember } = await this.supabase
      .from("group_members")
      .select("id, group_id, user_id")
      .eq("id", memberId)
      .single();

    if (!targetMember) throw new Error("Target member not found");

    const actor = await this.getMemberByLineUserId(
      targetMember.group_id,
      actorLineUserId
    );
    if (!actor || !canManageMembers(actor.role)) {
      throw new Error("Unauthorized: Only group owner can assign temporary admin");
    }

    const { error } = await this.supabase
      .from("group_members")
      .update({ temp_admin_until: untilIso })
      .eq("id", memberId);

    if (error) throw error;

    // Record audit log
    await this.supabase.from("audit_logs").insert({
      group_id: targetMember.group_id,
      actor_id: actor.userId,
      action: "ASSIGN_TEMP_ADMIN",
      entity_name: "group_members",
      entity_id: memberId,
      payload: { temp_admin_until: untilIso },
    });

    return true;
  }
}

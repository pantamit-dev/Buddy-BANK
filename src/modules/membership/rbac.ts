import type { MemberRole, MemberStatus } from "@/shared/types/database.types";

/**
 * Checks if a member role has permission to review, approve, or reject deposits
 */
export function canReviewDeposits(role: MemberRole | string | null | undefined): boolean {
  if (!role) return false;
  return role === "owner" || role === "treasurer";
}

/**
 * Checks if a member role can manage group rosters and promote members
 */
export function canManageMembers(role: MemberRole | string | null | undefined): boolean {
  if (!role) return false;
  return role === "owner";
}

/**
 * Checks if a member role can update group core settings (e.g. target amount)
 */
export function canUpdateGroupSettings(role: MemberRole | string | null | undefined): boolean {
  if (!role) return false;
  return role === "owner";
}

/**
 * Checks if a member's status permits submitting slips and participating in financial entries
 */
export function canSubmitSlips(status: MemberStatus | string | null | undefined): boolean {
  return status === "active";
}

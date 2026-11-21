import { z } from "zod";

export const MemberOnboardSchema = z.object({
  groupId: z.string().uuid(),
  lineUserId: z.string().min(1),
  displayName: z.string().min(1).max(100),
  pictureUrl: z.string().url().optional().nullable(),
});

export type MemberOnboard = z.infer<typeof MemberOnboardSchema>;

export const MemberStatusUpdateSchema = z.object({
  memberId: z.string().uuid(),
  status: z.enum(["active", "suspended", "pending_approval"]),
  actorLineUserId: z.string().min(1),
});

export type MemberStatusUpdate = z.infer<typeof MemberStatusUpdateSchema>;

export const MemberRoleUpdateSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["owner", "treasurer", "member", "viewer"]),
  actorLineUserId: z.string().min(1),
});

export type MemberRoleUpdate = z.infer<typeof MemberRoleUpdateSchema>;

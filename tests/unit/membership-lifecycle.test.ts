import { describe, it, expect, beforeEach } from "vitest";
import { MembershipService } from "@/modules/membership/service";
import { DepositService } from "@/modules/deposits/service";

describe("Advanced Membership Management (Suspension & Temp Admin) Unit Tests", () => {
  let mockDatabase: {
    profiles: any[];
    group_members: any[];
    deposits: any[];
    audit_logs: any[];
    groups: any[];
    ledger_entries: any[];
    transactions: any[];
  };

  let mockSupabase: any;
  let membershipService: MembershipService;
  let depositService: DepositService;

  beforeEach(() => {
    mockDatabase = {
      groups: [
        { id: "g-fund-1", name: "Family Fund", target_amount: 20000, owner_id: "p-owner" },
      ],
      profiles: [
        { id: "p-owner", line_user_id: "U_OWNER", display_name: "Alice Owner" },
        { id: "p-member", line_user_id: "U_MEMBER", display_name: "Bob Member" },
        { id: "p-other", line_user_id: "U_OTHER", display_name: "Charlie Other" },
      ],
      group_members: [
        {
          id: "gm-owner",
          group_id: "g-fund-1",
          user_id: "p-owner",
          role: "owner",
          status: "active",
          profiles: { id: "p-owner", line_user_id: "U_OWNER", display_name: "Alice Owner" },
        },
        {
          id: "gm-member",
          group_id: "g-fund-1",
          user_id: "p-member",
          role: "member",
          status: "active",
          profiles: { id: "p-member", line_user_id: "U_MEMBER", display_name: "Bob Member" },
        },
      ],
      deposits: [
        {
          id: "dep-100",
          group_id: "g-fund-1",
          member_id: "gm-member",
          detected_amount: 1000,
          status: "pending",
          click_count: 0,
        },
      ],
      audit_logs: [],
      transactions: [],
      ledger_entries: [
        {
          id: "led-1",
          group_id: "g-fund-1",
          member_id: "gm-owner",
          entry_type: "credit",
          amount: 5000,
          running_balance: 5000,
          created_at: new Date().toISOString(),
        },
      ],
    };

    mockSupabase = {
      storage: {
        from: () => ({
          upload: async (p: string) => ({ data: { path: p }, error: null }),
        }),
      },
      from: (table: string) => ({
        insert: (payload: any) => ({
          select: () => ({
            single: async () => {
              const record = {
                id: `${table}-${(mockDatabase as any)[table]?.length + 1}`,
                ...payload,
                created_at: new Date().toISOString(),
              };
              (mockDatabase as any)[table]?.push(record);
              return { data: record, error: null };
            },
          }),
          then: (resolve: any) => {
            const record = {
              id: `${table}-${(mockDatabase as any)[table]?.length + 1}`,
              ...payload,
              created_at: new Date().toISOString(),
            };
            (mockDatabase as any)[table]?.push(record);
            resolve({ data: record, error: null });
          },
        }),
        select: (cols: string) => ({
          eq: (f1: string, v1: any) => {
            const chain: any = {
              eq: (f2: string, v2: any) => ({
                maybeSingle: async () => {
                  const match = (mockDatabase as any)[table]?.find(
                    (r: any) => r[f1] === v1 && r[f2] === v2
                  );
                  return { data: match || null, error: null };
                },
                single: async () => {
                  const match = (mockDatabase as any)[table]?.find(
                    (r: any) => r[f1] === v1 && r[f2] === v2
                  );
                  return { data: match || null, error: match ? null : new Error("Not found") };
                },
              }),
              single: async () => {
                const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
                return { data: match || null, error: match ? null : new Error("Not found") };
              },
              maybeSingle: async () => {
                if (table === "profiles") {
                  const match = mockDatabase.profiles.find((p) => p[f1] === v1);
                  return { data: match || null, error: null };
                }
                const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
                return { data: match || null, error: null };
              },
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => {
                    const list = (mockDatabase as any)[table]?.filter((r: any) => r[f1] === v1);
                    return { data: list?.[list.length - 1] || null, error: null };
                  },
                }),
              }),
            };
            return chain;
          },
        }),
        update: (payload: any) => ({
          eq: (f1: string, v1: any) => {
            const chain: any = {
              eq: (f2: string, v2: any) => ({
                select: () => ({
                  maybeSingle: async () => {
                    const match = (mockDatabase as any)[table]?.find(
                      (r: any) => r[f1] === v1 && r[f2] === v2
                    );
                    if (!match) return { data: null, error: null };
                    Object.assign(match, payload);
                    return { data: match, error: null };
                  },
                  single: async () => {
                    const match = (mockDatabase as any)[table]?.find(
                      (r: any) => r[f1] === v1 && r[f2] === v2
                    );
                    if (!match) return { data: null, error: new Error("Not found") };
                    Object.assign(match, payload);
                    return { data: match, error: null };
                  },
                }),
              }),
              select: () => ({
                single: async () => {
                  const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
                  if (match) Object.assign(match, payload);
                  return { data: match, error: null };
                },
              }),
            };
            chain.then = (resolve: any) => {
              const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
              if (match) Object.assign(match, payload);
              resolve({ data: match, error: null });
            };
            return chain;
          },
        }),
      }),
    };

    membershipService = new MembershipService(mockSupabase);
    depositService = new DepositService(mockSupabase);
    (depositService as any).membershipService = membershipService;
  });

  describe("Member Suspension & Reactivation", () => {
    it("allows owner to suspend a member and writes audit log", async () => {
      const success = await membershipService.suspendMember({
        memberId: "gm-member",
        actorLineUserId: "U_OWNER",
        reason: "Suspected rule violation",
      });

      expect(success).toBe(true);

      const memberInDb = mockDatabase.group_members.find((m) => m.id === "gm-member");
      expect(memberInDb.status).toBe("suspended");

      const audit = mockDatabase.audit_logs.find((a) => a.action === "SUSPEND_MEMBER");
      expect(audit).toBeDefined();
      expect(audit.payload.reason).toBe("Suspected rule violation");
    });

    it("prevents non-owner from suspending another member", async () => {
      await expect(
        membershipService.suspendMember({
          memberId: "gm-owner",
          actorLineUserId: "U_MEMBER",
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it("allows owner to reactivate a suspended member and writes audit log", async () => {
      // First suspend
      const memberInDb = mockDatabase.group_members.find((m) => m.id === "gm-member");
      memberInDb.status = "suspended";

      // Reactivate
      const success = await membershipService.activateMember({
        memberId: "gm-member",
        actorLineUserId: "U_OWNER",
      });

      expect(success).toBe(true);
      expect(memberInDb.status).toBe("active");

      const audit = mockDatabase.audit_logs.find((a) => a.action === "ACTIVATE_MEMBER");
      expect(audit).toBeDefined();
    });
  });

  describe("Temporary Admin Privileges Assignment & Deposit Review", () => {
    it("allows owner to grant temporary admin with future expiry and enables deposit review", async () => {
      const untilDate = new Date(Date.now() + 2 * 3600000); // 2 hours from now

      const success = await membershipService.assignTemporaryAdmin({
        memberId: "gm-member",
        untilDate,
        actorLineUserId: "U_OWNER",
      });

      expect(success).toBe(true);

      const memberInDb = mockDatabase.group_members.find((m) => m.id === "gm-member");
      expect(memberInDb.temp_admin_until).toBe(untilDate.toISOString());

      // Bob Member now has temporary admin status and can review deposits!
      const reviewResult = await depositService.reviewDeposit({
        depositId: "dep-100",
        action: "approve",
        reviewerLineUserId: "U_MEMBER",
      });

      expect(reviewResult.success).toBe(true);
      expect(reviewResult.action).toBe("approve");
      expect(reviewResult.deposit?.status).toBe("verified");
    });

    it("blocks expired temporary admin from reviewing deposits", async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      const memberInDb = mockDatabase.group_members.find((m) => m.id === "gm-member");
      memberInDb.temp_admin_until = pastDate.toISOString();

      await expect(
        depositService.reviewDeposit({
          depositId: "dep-100",
          action: "approve",
          reviewerLineUserId: "U_MEMBER",
        })
      ).rejects.toThrow(/UNAUTHORIZED_REVIEWER/);
    });

    it("prevents non-owner from assigning temporary admin", async () => {
      await expect(
        membershipService.assignTemporaryAdmin({
          memberId: "gm-member",
          untilDate: new Date(),
          actorLineUserId: "U_MEMBER",
        })
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  describe("Member Role Assignment & Updates (Owner only)", () => {
    it("allows owner to promote a member to treasurer", async () => {
      const result = await membershipService.updateMemberRole({
        memberId: "gm-member",
        role: "treasurer",
        actorLineUserId: "U_OWNER",
      });

      expect(result.success).toBe(true);
      const memberInDb = mockDatabase.group_members.find((m) => m.id === "gm-member");
      expect(memberInDb.role).toBe("treasurer");

      // Verify audit log
      const audit = mockDatabase.audit_logs.find((a) => a.action === "UPDATE_MEMBER_ROLE");
      expect(audit).toBeDefined();
      expect(audit.payload.newRole).toBe("treasurer");
    });

    it("allows owner to change a member role to viewer", async () => {
      const result = await membershipService.updateMemberRole({
        memberId: "gm-member",
        role: "viewer",
        actorLineUserId: "U_OWNER",
      });

      expect(result.success).toBe(true);
      const memberInDb = mockDatabase.group_members.find((m) => m.id === "gm-member");
      expect(memberInDb.role).toBe("viewer");
    });

    it("strictly blocks non-owner from changing member roles", async () => {
      await expect(
        membershipService.updateMemberRole({
          memberId: "gm-member",
          role: "treasurer",
          actorLineUserId: "U_MEMBER",
        })
      ).rejects.toThrow(/Unauthorized/);
    });
  });
});

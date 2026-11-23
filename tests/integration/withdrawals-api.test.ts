import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// In-memory mock DB shared across route & handler tests
const mockDb: any = {
  groups: [],
  group_settings: [],
  group_members: [],
  profiles: [],
  withdrawals: [],
  withdrawal_votes: [],
  transactions: [],
  ledger_entries: [],
};

function createChain(table: string, initialData?: any) {
  let filters: Array<{ op: string; col: string; val: any }> = [];
  let limitVal: number | null = null;

  const execSelect = () => {
    let rows = [...(mockDb[table] || [])];
    for (const f of filters) {
      if (f.op === "eq") rows = rows.filter((r) => r[f.col] === f.val);
      if (f.op === "in") rows = rows.filter((r) => f.val.includes(r[f.col]));
      if (f.op === "lte") rows = rows.filter((r) => r[f.col] <= f.val);
    }

    // Hydrate simple joins used in /api/withdrawals & WithdrawalService
    rows = rows.map((r) => {
      const copy = { ...r };
      if (table === "withdrawals") {
        const gm = mockDb.group_members.find((m: any) => m.id === r.requested_by);
        const prof = gm ? mockDb.profiles.find((p: any) => p.id === gm.user_id) : null;
        copy.group_members = gm ? { ...gm, profiles: prof || null } : null;
        const grp = mockDb.groups.find((g: any) => g.id === r.group_id);
        copy.groups = grp || null;
      }
      if (table === "withdrawal_votes") {
        const gm = mockDb.group_members.find((m: any) => m.id === r.member_id);
        const prof = gm ? mockDb.profiles.find((p: any) => p.id === gm.user_id) : null;
        copy.group_members = gm ? { ...gm, profiles: prof || null } : null;
      }
      if (table === "group_members") {
        const prof = mockDb.profiles.find((p: any) => p.id === r.user_id);
        copy.profiles = prof || null;
      }
      return copy;
    });

    if (limitVal !== null) rows = rows.slice(0, limitVal);
    return rows;
  };

  const chain: any = {
    eq(col: string, val: any) {
      filters.push({ op: "eq", col, val });
      return chain;
    },
    in(col: string, val: any[]) {
      filters.push({ op: "in", col, val });
      return chain;
    },
    lte(col: string, val: any) {
      filters.push({ op: "lte", col, val });
      return chain;
    },
    order() {
      return chain;
    },
    range(start: number, end: number) {
      limitVal = end - start + 1;
      return chain;
    },
    limit(n: number) {
      limitVal = n;
      return chain;
    },
    select() {
      return chain;
    },
    async single() {
      if (initialData) return { data: initialData, error: null };
      const rows = execSelect();
      return {
        data: rows[0] || null,
        error: rows[0] ? null : new Error("Not found"),
      };
    },
    async maybeSingle() {
      if (initialData) return { data: initialData, error: null };
      const rows = execSelect();
      return { data: rows[0] || null, error: null };
    },
    then(resolve: any) {
      const rows = execSelect();
      resolve({ data: rows, count: rows.length, error: null });
    },
  };
  return chain;
}

vi.mock("@/integrations/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: (_cols?: string, opts?: any) => {
        const c = createChain(table);
        if (opts?.head) {
          return c;
        }
        return c;
      },
      insert: (payload: any) => {
        const row = {
          id: `${table}-${(mockDb[table]?.length || 0) + 1}`,
          created_at: new Date().toISOString(),
          ...payload,
        };
        mockDb[table].push(row);
        return createChain(table, row);
      },
      upsert: async (payload: any) => {
        const idx = mockDb[table].findIndex(
          (r: any) =>
            r.withdrawal_id === payload.withdrawal_id && r.member_id === payload.member_id
        );
        if (idx >= 0) {
          mockDb[table][idx] = { ...mockDb[table][idx], ...payload };
        } else {
          mockDb[table].push({ id: `wv-${mockDb[table].length + 1}`, ...payload });
        }
        return { error: null };
      },
      update: (payload: any) => {
        const filters: Array<{ op: string; col: string; val: any }> = [];
        const updChain: any = {
          eq(col: string, val: any) {
            filters.push({ op: "eq", col, val });
            return updChain;
          },
          lte(col: string, val: any) {
            filters.push({ op: "lte", col, val });
            return updChain;
          },
          select() {
            return updChain;
          },
          async maybeSingle() {
            const matches = (mockDb[table] || []).filter((r: any) =>
              filters.every((f) =>
                f.op === "eq" ? r[f.col] === f.val : r[f.col] <= f.val
              )
            );
            matches.forEach((m: any) => Object.assign(m, payload));
            return { data: matches[0] || null, error: null };
          },
          then(resolve: any) {
            const matches = (mockDb[table] || []).filter((r: any) =>
              filters.every((f) =>
                f.op === "eq" ? r[f.col] === f.val : r[f.col] <= f.val
              )
            );
            matches.forEach((m: any) => Object.assign(m, payload));
            resolve({ data: matches, error: null });
          },
        };
        return updChain;
      },
    }),
  }),
}));

import { GET, POST, PATCH } from "@/app/api/withdrawals/route";
import { CommandHandler } from "@/modules/commands/handler";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("/api/withdrawals & #เบิก command integration", () => {
  beforeEach(() => {
    mockDb.groups = [
      { id: GROUP_ID, line_group_id: "C_GROUP_1", name: "ทริปเชียงใหม่", target_amount: 10000 },
    ];
    mockDb.group_settings = [
      { group_id: GROUP_ID, voting_quorum_percent: 50, voting_duration_hours: 48 },
    ];
    mockDb.profiles = [
      { id: "prof-1", line_user_id: "U_1", display_name: "Alice" },
      { id: "prof-2", line_user_id: "U_2", display_name: "Bob" },
      { id: "prof-3", line_user_id: "U_3", display_name: "Charlie" },
    ];
    mockDb.group_members = [
      { id: "gm-1", group_id: GROUP_ID, user_id: "prof-1", role: "owner", status: "active" },
      { id: "gm-2", group_id: GROUP_ID, user_id: "prof-2", role: "member", status: "active" },
      { id: "gm-3", group_id: GROUP_ID, user_id: "prof-3", role: "member", status: "active" },
    ];
    mockDb.withdrawals = [];
    mockDb.withdrawal_votes = [];
    mockDb.transactions = [];
    mockDb.ledger_entries = [
      {
        id: "led-1",
        group_id: GROUP_ID,
        member_id: "gm-1",
        entry_type: "credit",
        amount: 5000,
        running_balance: 5000,
        created_at: new Date().toISOString(),
      },
    ];
  });

  it("creates, lists, votes to quorum, and approves a withdrawal via API", async () => {
    // 1. POST create withdrawal
    const createReq = new NextRequest("http://localhost/api/withdrawals", {
      method: "POST",
      body: JSON.stringify({
        groupId: GROUP_ID,
        requesterLineUserId: "U_2",
        amount: 1200,
        purpose: "ค่ารถตู้",
      }),
    });
    const createRes = await POST(createReq);
    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    expect(createJson.requiredApprovals).toBe(2); // ceil(3 * 0.5) = 2

    // Assign a valid UUID so PATCH schema validates
    const withdrawalUuid = "22222222-2222-4222-8222-222222222222";
    mockDb.withdrawals[0].id = withdrawalUuid;

    // 2. GET list
    const getReq = new NextRequest(`http://localhost/api/withdrawals?groupId=${GROUP_ID}`);
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.withdrawals).toHaveLength(1);
    expect(getJson.quorumConfig.requiredApprovals).toBe(2);

    // 3. First vote (U_1 approve) -> still pending_vote
    const vote1Res = await PATCH(
      new NextRequest("http://localhost/api/withdrawals", {
        method: "PATCH",
        body: JSON.stringify({
          action: "vote",
          withdrawalId: withdrawalUuid,
          voterLineUserId: "U_1",
          choice: "approve",
        }),
      })
    );
    const vote1Json = await vote1Res.json();
    expect(vote1Res.status).toBe(200);
    expect(vote1Json.voteResult.status).toBe("pending_vote");
    expect(vote1Json.voteResult.approveVotes).toBe(1);

    // 4. Second vote (U_3 approve) -> quorum reached -> approved!
    const vote2Res = await PATCH(
      new NextRequest("http://localhost/api/withdrawals", {
        method: "PATCH",
        body: JSON.stringify({
          action: "vote",
          withdrawalId: withdrawalUuid,
          voterLineUserId: "U_3",
          choice: "approve",
        }),
      })
    );
    const vote2Json = await vote2Res.json();
    expect(vote2Res.status).toBe(200);
    expect(vote2Json.voteResult.status).toBe("approved");
    expect(vote2Json.voteResult.quorumReached).toBe(true);
    expect(mockDb.ledger_entries).toHaveLength(2);
    expect(mockDb.ledger_entries[1].entry_type).toBe("debit");
    expect(mockDb.ledger_entries[1].running_balance).toBe(3800);
  });

  it("allows requester or owner to cancel a pending withdrawal", async () => {
    const withdrawalUuid = "33333333-3333-4333-8333-333333333333";
    mockDb.withdrawals.push({
      id: withdrawalUuid,
      group_id: GROUP_ID,
      requested_by: "gm-2",
      amount: 500,
      purpose: "ค่าขนม",
      status: "pending_vote",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      created_at: new Date().toISOString(),
    });

    const cancelRes = await PATCH(
      new NextRequest("http://localhost/api/withdrawals", {
        method: "PATCH",
        body: JSON.stringify({
          action: "cancel",
          withdrawalId: withdrawalUuid,
          actorLineUserId: "U_2",
        }),
      })
    );
    const cancelJson = await cancelRes.json();
    expect(cancelRes.status).toBe(200);
    expect(cancelJson.status).toBe("cancelled");
    expect(mockDb.withdrawals[0].status).toBe("cancelled");
  });

  it("handles #เบิก command in LINE chat to open voting Flex message", async () => {
    const handler = new CommandHandler();
    const reply = await handler.handleCommand({
      text: "#เบิก 800 ค่าอาหารกลางวัน",
      lineGroupId: "C_GROUP_1",
      lineUserId: "U_2",
    });

    expect(reply).not.toBeNull();
    expect(reply?.type).toBe("flex");
    expect((reply as any).altText).toContain("800");
    expect(mockDb.withdrawals).toHaveLength(1);
    expect(mockDb.withdrawals[0].purpose).toBe("ค่าอาหารกลางวัน");
  });
});

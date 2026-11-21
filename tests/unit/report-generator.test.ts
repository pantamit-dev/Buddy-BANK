import { describe, it, expect, beforeEach } from "vitest";
import { ReportGeneratorService } from "@/modules/reports/generator";

describe("Financial Report Generator Unit Tests", () => {
  let mockDatabase: {
    groups: any[];
    ledger_entries: any[];
    group_members: any[];
    reports: any[];
  };

  let mockSupabase: any;
  let reportGenerator: ReportGeneratorService;

  beforeEach(() => {
    mockDatabase = {
      groups: [
        {
          id: "g-japan",
          name: "Japan Trip 2027",
          target_amount: 50000,
        },
      ],
      group_members: [
        {
          id: "gm-1",
          group_id: "g-japan",
          role: "owner",
          status: "active",
          profiles: { display_name: "Alice Owner" },
        },
        {
          id: "gm-2",
          group_id: "g-japan",
          role: "member",
          status: "active",
          profiles: { display_name: "Bob Member" },
        },
      ],
      ledger_entries: [
        {
          id: "led-1",
          group_id: "g-japan",
          member_id: "gm-2",
          entry_type: "credit",
          amount: 2500,
          running_balance: 2500,
          created_at: new Date(2026, 10, 15, 10, 0, 0).toISOString(),
          group_members: { profiles: { display_name: "Bob Member" } },
        },
        {
          id: "led-2",
          group_id: "g-japan",
          member_id: "gm-1",
          entry_type: "debit",
          amount: 1000,
          running_balance: 1500,
          created_at: new Date(2026, 10, 16, 14, 0, 0).toISOString(),
          group_members: { profiles: { display_name: "Alice Owner" } },
        },
      ],
      reports: [],
    };

    mockSupabase = {
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, buffer: any) => ({
            data: { path: `${bucket}/${path}` },
            error: null,
          }),
          createSignedUrl: async (path: string, expiresIn: number) => ({
            data: { signedUrl: `https://storage.mock.local/${path}?token=mock_token` },
            error: null,
          }),
        }),
      },
      from: (table: string) => ({
        select: (cols: string) => ({
          eq: (f1: string, v1: any) => {
            const chain: any = {
              single: async () => {
                const match = (mockDatabase as any)[table]?.find((r: any) => r[f1] === v1);
                return { data: match || null, error: match ? null : new Error("Not found") };
              },
              order: () => ({
                then: (resolve: any) => {
                  const list = (mockDatabase as any)[table]?.filter((r: any) => r[f1] === v1);
                  resolve({ data: list || [], error: null });
                },
              }),
            };
            chain.then = (resolve: any) => {
              const list = (mockDatabase as any)[table]?.filter((r: any) => r[f1] === v1);
              resolve({ data: list || [], error: null });
            };
            return chain;
          },
        }),
        insert: (payload: any) => ({
          select: () => ({
            single: async () => {
              const record = {
                id: `rep-${mockDatabase.reports.length + 1}`,
                ...payload,
                created_at: new Date().toISOString(),
              };
              mockDatabase.reports.push(record);
              return { data: record, error: null };
            },
          }),
        }),
      }),
    };

    reportGenerator = new ReportGeneratorService(mockSupabase);
  });

  describe("Excel Report Generation (ExcelJS)", () => {
    it("generates multi-sheet Excel file and saves to storage and database", async () => {
      const result = await reportGenerator.generateMonthlyExcelReport("g-japan", "2026-11");

      expect(result).toBeDefined();
      expect(result.reportId).toBe("rep-1");
      expect(result.reportType).toBe("monthly_summary");
      expect(result.period).toBe("2026-11");
      expect(result.storagePath).toContain("reports/g-japan/2026-11_financial_report_");
      expect(result.signedUrl).toContain("https://storage.mock.local/");

      const savedReport = mockDatabase.reports[0];
      expect(savedReport.status).toBe("completed");
      expect(savedReport.period).toBe("2026-11");
    });
  });

  describe("CSV Report Export", () => {
    it("generates valid CSV formatted financial entries", async () => {
      const csv = await reportGenerator.generateCsvReport("g-japan");

      expect(csv).toContain("ID,Date,Member,Type,Amount,RunningBalance");
      expect(csv).toContain("Bob Member");
      expect(csv).toContain("Alice Owner");
      expect(csv).toContain("credit");
      expect(csv).toContain("debit");
    });
  });
});

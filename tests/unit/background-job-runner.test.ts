import { describe, it, expect, vi, beforeEach } from "vitest";
import { BackgroundJobRunner } from "@/modules/jobs/runner";

describe("Background Job Runner & Scheduler Unit Tests", () => {
  let mockJobs: any[];
  let mockSupabase: any;
  let mockLineClient: any;
  let runner: BackgroundJobRunner;

  beforeEach(() => {
    mockJobs = [];

    mockSupabase = {
      from: (table: string) => ({
        insert: (payload: any) => ({
          select: () => ({
            single: async () => {
              const record = {
                id: `job-${mockJobs.length + 1}`,
                ...payload,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              mockJobs.push(record);
              return { data: record, error: null };
            },
          }),
        }),
        select: (cols: string) => ({
          eq: (f1: string, v1: any) => ({
            lte: (f2: string, v2: any) => ({
              order: () => ({
                limit: async (lim: number) => {
                  const filtered = mockJobs.filter(
                    (j) => j[f1] === v1 && new Date(j[f2]).getTime() <= new Date(v2).getTime()
                  );
                  return { data: filtered.slice(0, lim), error: null };
                },
              }),
            }),
            eq: (f2: string, v2: any) => ({
              maybeSingle: async () => {
                const match = mockJobs.find((j) => j[f1] === v1 && j[f2] === v2);
                return { data: match || null, error: null };
              },
            }),
            in: (f2: string, v2: any[]) => ({
              lte: () => ({
                data: [],
              }),
            }),
          }),
        }),
        update: (payload: any) => ({
          eq: (f1: string, v1: any) => {
            const chain: any = {
              lte: () => ({
                eq: () => ({ select: async () => ({ data: [{ id: "expired-wd-1" }], error: null }) }),
                select: async () => ({ data: [{ id: "expired-wd-1" }], error: null }),
              }),
              eq: (f2: string, v2: any) => ({
                select: () => ({
                  maybeSingle: async () => {
                    const match = mockJobs.find((j) => j[f1] === v1 && j[f2] === v2);
                    if (!match) return { data: null, error: null };
                    Object.assign(match, payload);
                    return { data: match, error: null };
                  },
                }),
              }),
            };
            // Also support direct .eq(id, val) without second .eq
            chain.then = (resolve: any) => {
              const match = mockJobs.find((j) => j[f1] === v1);
              if (match) Object.assign(match, payload);
              resolve({ data: match, error: null });
            };
            return chain;
          },
        }),
      }),
    };

    mockLineClient = {
      pushMessage: vi.fn().mockResolvedValue({}),
      replyMessage: vi.fn().mockResolvedValue({}),
      showLoadingAnimation: vi.fn().mockResolvedValue(true),
    };

    runner = new BackgroundJobRunner(mockSupabase, mockLineClient);
  });

  describe("Job Scheduling", () => {
    it("schedules a new background job into PostgreSQL with pending status", async () => {
      const job = await runner.scheduleJob({
        groupId: "g-japan-trip",
        jobType: "weekly_summary",
        payload: { targetLineGroupId: "C_GROUP_123" },
        maxAttempts: 3,
      });

      expect(job).toBeDefined();
      expect(job.status).toBe("pending");
      expect(job.attempts).toBe(0);
      expect(job.max_attempts).toBe(3);
      expect(job.job_type).toBe("weekly_summary");
      expect(mockJobs.length).toBe(1);
    });
  });

  describe("Due Jobs Querying", () => {
    it("returns jobs scheduled in the past or present, ignoring future jobs", async () => {
      // Due job (past)
      mockJobs.push({
        id: "job-due-1",
        job_type: "weekly_summary",
        status: "pending",
        run_at: new Date(Date.now() - 60000).toISOString(),
      });

      // Future job
      mockJobs.push({
        id: "job-future-2",
        job_type: "monthly_summary",
        status: "pending",
        run_at: new Date(Date.now() + 3600000).toISOString(),
      });

      const dueJobs = await runner.getDueJobs();
      expect(dueJobs.length).toBe(1);
      expect(dueJobs[0].id).toBe("job-due-1");
    });
  });

  describe("Job Execution & Handler Dispatching", () => {
    it("executes handler and marks job completed upon success", async () => {
      mockJobs.push({
        id: "job-exec-1",
        group_id: "g-1",
        job_type: "report_generation",
        payload: { reportType: "monthly_summary" },
        status: "pending",
        attempts: 0,
        max_attempts: 3,
        run_at: new Date().toISOString(),
      });

      const result = await runner.executeJob("job-exec-1");

      expect(result.success).toBe(true);
      expect(result.jobId).toBe("job-exec-1");
      const jobInDb = mockJobs.find((j) => j.id === "job-exec-1");
      expect(jobInDb.status).toBe("completed");
    });

    it("executes expire_stale_withdrawals job handler successfully", async () => {
      mockJobs.push({
        id: "job-expire-wd-1",
        group_id: "g-1",
        job_type: "expire_stale_withdrawals",
        payload: {},
        status: "pending",
        attempts: 0,
        max_attempts: 3,
        run_at: new Date().toISOString(),
      });

      const result = await runner.executeJob("job-expire-wd-1");
      expect(result.success).toBe(true);
      expect(result.result.type).toBe("expire_stale_withdrawals");
      expect(result.result.expiredCount).toBe(1);
    });
  });

  describe("Exponential Backoff Retries & Dead Letter Queue", () => {
    it("schedules next retry with exponential backoff on transient failure", async () => {
      mockJobs.push({
        id: "job-retry-1",
        group_id: "g-1",
        job_type: "weekly_summary",
        status: "pending",
        attempts: 0,
        max_attempts: 3,
        run_at: new Date().toISOString(),
      });

      // Execute with a custom failing handler
      const result = await runner.executeJob("job-retry-1", {
        backoffBaseMs: 1000,
        customHandler: async () => {
          throw new Error("LINE API Network Timeout");
        },
      });

      expect(result.success).toBe(false);
      expect(result.isDeadLetter).toBeFalsy();
      expect(result.nextRunAt).toBeDefined();

      const jobInDb = mockJobs.find((j) => j.id === "job-retry-1");
      expect(jobInDb.status).toBe("pending");
      expect(jobInDb.attempts).toBe(1);
      expect(jobInDb.last_error).toContain("LINE API Network Timeout");
    });

    it("moves job to dead_letter queue after exhausting max_attempts", async () => {
      mockJobs.push({
        id: "job-exhaust-1",
        group_id: "g-1",
        job_type: "weekly_summary",
        status: "pending",
        attempts: 2, // 2 prior failures, max is 3
        max_attempts: 3,
        run_at: new Date().toISOString(),
      });

      const result = await runner.executeJob("job-exhaust-1", {
        customHandler: async () => {
          throw new Error("Persistent Database Failure");
        },
      });

      expect(result.success).toBe(false);
      expect(result.isDeadLetter).toBe(true);

      const jobInDb = mockJobs.find((j) => j.id === "job-exhaust-1");
      expect(jobInDb.status).toBe("dead_letter");
      expect(jobInDb.attempts).toBe(3);
      expect(jobInDb.last_error).toContain("Dead Letter after 3 attempts");
    });
  });
});

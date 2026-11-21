import { createAdminClient } from "@/integrations/supabase/server";
import { LineApiClient } from "@/modules/line-webhook/line-client";
import { LedgerService } from "@/modules/ledger/service";
import {
  BackgroundJobType,
  BackgroundJobPayload,
  JobExecutionResult,
} from "./types";

export interface ScheduleJobOptions {
  groupId?: string | null;
  jobType: BackgroundJobType;
  payload?: BackgroundJobPayload;
  runAt?: Date | string;
  maxAttempts?: number;
}

export class BackgroundJobRunner {
  private lineClient: LineApiClient;
  private ledgerService: LedgerService;

  constructor(
    private supabase = createAdminClient(),
    lineClient?: LineApiClient
  ) {
    this.lineClient = lineClient || new LineApiClient();
    this.ledgerService = new LedgerService(this.supabase);
  }

  /**
   * Schedules a new background job into PostgreSQL
   */
  async scheduleJob(options: ScheduleJobOptions) {
    const {
      groupId = null,
      jobType,
      payload = {},
      runAt = new Date(),
      maxAttempts = 3,
    } = options;

    const runAtIso = typeof runAt === "string" ? runAt : runAt.toISOString();

    const { data, error } = await this.supabase
      .from("background_jobs")
      .insert({
        group_id: groupId,
        job_type: jobType,
        payload: payload as any,
        status: "pending",
        attempts: 0,
        max_attempts: maxAttempts,
        run_at: runAtIso,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Fetches all due pending jobs ready for execution
   */
  async getDueJobs(limit = 10) {
    const nowIso = new Date().toISOString();

    const { data, error } = await this.supabase
      .from("background_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("run_at", nowIso)
      .order("run_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Atomically claims and executes a single background job with exponential backoff retries
   */
  async executeJob(
    jobId: string,
    options?: { backoffBaseMs?: number; customHandler?: (job: any) => Promise<any> }
  ): Promise<JobExecutionResult> {
    // 1. Claim job atomically (pending -> processing)
    const { data: job, error: fetchErr } = await this.supabase
      .from("background_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("status", "pending")
      .maybeSingle();

    if (fetchErr || !job) {
      return {
        success: false,
        jobId,
        error: "Job not found or not in pending status",
      };
    }

    const { data: claimedJob, error: claimErr } = await this.supabase
      .from("background_jobs")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (claimErr || !claimedJob) {
      return {
        success: false,
        jobId,
        error: "Failed to claim job: Concurrent execution in progress",
      };
    }

    // 2. Dispatch to specific handler
    try {
      let executionOutput: any = null;

      if (options?.customHandler) {
        executionOutput = await options.customHandler(claimedJob);
      } else {
        executionOutput = await this.dispatchHandler(claimedJob);
      }

      // Mark completed
      await this.supabase
        .from("background_jobs")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", jobId);

      return {
        success: true,
        jobId,
        result: executionOutput,
      };
    } catch (err: any) {
      // 3. Handle failure with exponential backoff or dead letter
      const nextAttempts = (claimedJob.attempts || 0) + 1;
      const maxAttempts = claimedJob.max_attempts || 3;
      const errorMessage = err?.message || String(err);

      if (nextAttempts >= maxAttempts) {
        // Dead Letter
        await this.supabase
          .from("background_jobs")
          .update({
            status: "dead_letter",
            attempts: nextAttempts,
            last_error: `Dead Letter after ${nextAttempts} attempts: ${errorMessage}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        return {
          success: false,
          jobId,
          isDeadLetter: true,
          error: errorMessage,
        };
      } else {
        // Exponential Backoff
        const baseMs = options?.backoffBaseMs ?? 60000;
        const delayMs = baseMs * Math.pow(2, nextAttempts - 1);
        const nextRunAt = new Date(Date.now() + delayMs).toISOString();

        await this.supabase
          .from("background_jobs")
          .update({
            status: "pending",
            attempts: nextAttempts,
            run_at: nextRunAt,
            last_error: `Attempt ${nextAttempts} failed: ${errorMessage}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        return {
          success: false,
          jobId,
          nextRunAt,
          error: errorMessage,
        };
      }
    }
  }

  /**
   * Internal dispatcher for built-in job types
   */
  private async dispatchHandler(job: any): Promise<any> {
    const jobType = job.job_type as BackgroundJobType;
    const payload = (job.payload || {}) as BackgroundJobPayload;
    const groupId = job.group_id;

    switch (jobType) {
      case "weekly_summary":
        return await this.handleWeeklySummary(groupId, payload);
      case "monthly_summary":
        return await this.handleMonthlySummary(groupId, payload);
      case "pending_slip_alert":
        return await this.handlePendingSlipAlert(groupId, payload);
      case "report_generation":
        return await this.handleReportGeneration(groupId, payload);
      case "expire_stale_withdrawals":
        return await this.handleExpireStaleWithdrawals(groupId);
      default:
        throw new Error(`Unsupported job type: ${jobType}`);
    }
  }

  private async handleWeeklySummary(groupId: string | null, payload: BackgroundJobPayload) {
    if (!groupId) throw new Error("Weekly summary requires group_id");

    const balance = await this.ledgerService.getGroupBalance(groupId);
    const targetGroup = payload.targetLineGroupId;

    const messageText =
      `📊 สรุปยอดเงินกองกลางประจำสัปดาห์\n` +
      `ยอดคงเหลือปัจจุบัน: ฿${balance.currentBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n` +
      `เป้าหมาย: ฿${balance.targetAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} (${balance.progressPercentage}%)\n` +
      `สมาชิกที่ร่วมสมทบแล้ว: ${balance.contributingMembersCount} ท่าน`;

    if (targetGroup) {
      try {
        await this.lineClient.pushMessage(targetGroup, [{ type: "text", text: messageText }]);
      } catch (err) {
        console.warn("[BackgroundJobRunner] LINE push failed (mock/invalid group):", err);
      }
    }

    return { type: "weekly_summary", balance: balance.currentBalance, text: messageText };
  }

  private async handleMonthlySummary(groupId: string | null, payload: BackgroundJobPayload) {
    if (!groupId) throw new Error("Monthly summary requires group_id");

    const balance = await this.ledgerService.getGroupBalance(groupId);
    const period = payload.period || new Date().toISOString().substring(0, 7);
    const targetGroup = payload.targetLineGroupId;

    const messageText =
      `🗓️ สรุปบัญชีกองกลางประจำเดือน ${period}\n` +
      `ยอดรวมสะสม: ฿${balance.currentBalance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n` +
      `เป้าหมาย: ฿${balance.targetAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n` +
      `ความคืบหน้า: ${balance.progressPercentage}% 🎉`;

    if (targetGroup) {
      try {
        await this.lineClient.pushMessage(targetGroup, [{ type: "text", text: messageText }]);
      } catch (err) {
        console.warn("[BackgroundJobRunner] LINE push failed:", err);
      }
    }

    return { type: "monthly_summary", period, balance: balance.currentBalance };
  }

  private async handlePendingSlipAlert(groupId: string | null, payload: BackgroundJobPayload) {
    if (!groupId) throw new Error("Pending slip alert requires group_id");

    const hours = payload.alertAgeHours || 24;
    const thresholdDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data: pendingSlips } = await this.supabase
      .from("deposits")
      .select("id, status, created_at, detected_amount")
      .eq("group_id", groupId)
      .in("status", ["pending", "needs_review"])
      .lte("created_at", thresholdDate);

    const count = pendingSlips?.length || 0;
    if (count > 0 && payload.targetLineGroupId) {
      const alertMsg = `⚠️ แจ้งเตือน: มีสลิปโอนเงินค้างตรวจสอบ ${count} รายการ (เกินกว่า ${hours} ชั่วโมง) โปรดตรวจสอบใน Mini App`;
      try {
        await this.lineClient.pushMessage(payload.targetLineGroupId, [{ type: "text", text: alertMsg }]);
      } catch (err) {
        console.warn("[BackgroundJobRunner] LINE push failed:", err);
      }
    }

    return { pendingCount: count, thresholdDate };
  }

  private async handleReportGeneration(groupId: string | null, payload: BackgroundJobPayload) {
    if (!groupId) throw new Error("Report generation requires group_id");
    return {
      type: "report_generation",
      groupId,
      status: "queued",
      reportType: payload.reportType || "monthly_summary",
    };
  }

  private async handleExpireStaleWithdrawals(groupId: string | null) {
    const nowIso = new Date().toISOString();
    let query: any = this.supabase
      .from("withdrawals")
      .update({ status: "rejected" })
      .eq("status", "pending_vote")
      .lte("expires_at", nowIso);

    if (groupId) {
      query = query.eq("group_id", groupId);
    }

    const { data } = await query.select("id");
    return {
      type: "expire_stale_withdrawals",
      expiredCount: data?.length || 0,
      timestamp: nowIso,
    };
  }
}

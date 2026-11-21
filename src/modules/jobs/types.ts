import { JobStatus } from "@/shared/types/database.types";

export type BackgroundJobType =
  | "weekly_summary"
  | "monthly_summary"
  | "pending_slip_alert"
  | "report_generation"
  | "expire_stale_withdrawals";

export interface BackgroundJobPayload {
  channel?: "line_group" | "mini_app" | "internal";
  targetLineGroupId?: string;
  period?: string; // e.g. "2026-11"
  alertAgeHours?: number; // threshold for pending slip alert
  reportType?: "monthly_summary" | "financial_audit" | "excel_export" | "pdf_report";
  customMessage?: string;
  [key: string]: any;
}

export interface BackgroundJobRecord {
  id: string;
  group_id: string | null;
  job_type: BackgroundJobType;
  payload: BackgroundJobPayload;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_at: string;
  created_at: string;
  updated_at: string;
  last_error: string | null;
}

export interface JobExecutionResult {
  success: boolean;
  jobId: string;
  result?: any;
  error?: string;
  nextRunAt?: string;
  isDeadLetter?: boolean;
}

import { createAdminClient } from "@/integrations/supabase/server";
import type { DepositStatus } from "@/shared/types/database.types";

export interface TransitionLockResult {
  success: boolean;
  deposit?: any;
  message?: string;
}

export class DepositStateMachine {
  constructor(private supabase = createAdminClient()) {}

  /**
   * Attempts an atomic idempotency lock:
   * Moves status from 'pending' to 'processing' and increments click_count.
   * If deposit was not in 'pending' status, returns success: false.
   */
  async lockForProcessing(depositId: string): Promise<TransitionLockResult> {
    const { data, error } = await this.supabase
      .from("deposits")
      .select("*")
      .eq("id", depositId)
      .eq("status", "pending")
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        message: "รายการนี้ไม่ได้อยู่ในสถานะรอดำเนินการ หรือถูกประมวลผลไปแล้ว",
      };
    }

    // Perform atomic conditional update
    const { data: updated, error: updateErr } = await this.supabase
      .from("deposits")
      .update({
        status: "processing",
        click_count: (data.click_count || 0) + 1,
      })
      .eq("id", depositId)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (updateErr || !updated) {
      return {
        success: false,
        message: "มีผู้กดดำเนินการรายการนี้แล้วพร้อมกัน",
      };
    }

    return {
      success: true,
      deposit: updated,
    };
  }

  /**
   * Completes the transition to 'verified'
   */
  async markVerified(params: {
    depositId: string;
    reviewerProfileId: string;
    verifiedAmount?: number;
  }) {
    const { depositId, reviewerProfileId, verifiedAmount } = params;

    const updatePayload: any = {
      status: "verified",
      reviewed_by: reviewerProfileId,
      reviewed_at: new Date().toISOString(),
    };

    if (verifiedAmount !== undefined && verifiedAmount > 0) {
      updatePayload.detected_amount = verifiedAmount;
    }

    const { data, error } = await this.supabase
      .from("deposits")
      .update(updatePayload)
      .eq("id", depositId)
      .eq("status", "processing")
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Completes the transition to 'rejected'
   */
  async markRejected(params: {
    depositId: string;
    reviewerProfileId: string;
    reason?: string;
  }) {
    const { depositId, reviewerProfileId, reason } = params;

    const { data, error } = await this.supabase
      .from("deposits")
      .update({
        status: "rejected",
        reviewed_by: reviewerProfileId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", depositId)
      .eq("status", "processing")
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Resets status back to 'pending' if processing fails unexpectedly
   */
  async rollbackProcessing(depositId: string) {
    await this.supabase
      .from("deposits")
      .update({ status: "pending" })
      .eq("id", depositId)
      .eq("status", "processing");
  }
}

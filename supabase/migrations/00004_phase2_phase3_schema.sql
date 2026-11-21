-- ==============================================================================
-- 00004_phase2_phase3_schema.sql
-- Money Pool (Bank Buddy) - Phase 2 & Phase 3 Database Schema & RLS
-- ==============================================================================

-- 1. Alter deposits table for fraud detection
ALTER TABLE public.deposits
    ADD COLUMN IF NOT EXISTS file_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS perceptual_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS fraud_risk_score INT CHECK (fraud_risk_score >= 0 AND fraud_risk_score <= 100);

-- Update deposits status check to allow 'needs_review'
ALTER TABLE public.deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
ALTER TABLE public.deposits ADD CONSTRAINT deposits_status_check 
    CHECK (status IN ('pending', 'processing', 'verified', 'rejected', 'cancelled', 'needs_review'));

CREATE INDEX IF NOT EXISTS idx_deposits_file_sha256 ON public.deposits(file_sha256);
CREATE INDEX IF NOT EXISTS idx_deposits_perceptual_hash ON public.deposits(perceptual_hash);
CREATE INDEX IF NOT EXISTS idx_deposits_fraud_risk ON public.deposits(fraud_risk_score);

-- 2. Group Settings Table
CREATE TABLE IF NOT EXISTS public.group_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL UNIQUE REFERENCES public.groups(id) ON DELETE CASCADE,
    rules JSONB DEFAULT '{"rule_type":"monthly_fixed","minimum_deposit":0,"monthly_due_day":28,"monthly_amount":0,"excess_handling":"rollover","grace_period_days":3}'::jsonb NOT NULL,
    voting_quorum_percent NUMERIC(5, 2) DEFAULT 50.00 NOT NULL CHECK (voting_quorum_percent >= 0 AND voting_quorum_percent <= 100),
    voting_duration_hours INT DEFAULT 48 NOT NULL CHECK (voting_duration_hours > 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_group_settings_group ON public.group_settings(group_id);

-- 3. Background Jobs Table
CREATE TABLE IF NOT EXISTS public.background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    job_type VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    attempts INT DEFAULT 0 NOT NULL,
    max_attempts INT DEFAULT 3 NOT NULL,
    run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status_run ON public.background_jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_background_jobs_group ON public.background_jobs(group_id);

-- 4. Withdrawals Table
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    purpose TEXT NOT NULL,
    receipt_storage_path TEXT,
    status VARCHAR(20) DEFAULT 'pending_vote' NOT NULL CHECK (status IN ('pending_vote', 'approved', 'rejected', 'cancelled', 'paid')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_group_status ON public.withdrawals(group_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_requested_by ON public.withdrawals(requested_by);

-- 5. Withdrawal Votes Table
CREATE TABLE IF NOT EXISTS public.withdrawal_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_id UUID NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
    vote_choice VARCHAR(20) NOT NULL CHECK (vote_choice IN ('approve', 'reject')),
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_withdrawal_member_vote UNIQUE (withdrawal_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_votes_withdrawal ON public.withdrawal_votes(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_votes_member ON public.withdrawal_votes(member_id);

-- 6. Alter transactions table to support withdrawals
ALTER TABLE public.transactions ALTER COLUMN deposit_id DROP NOT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS withdrawal_id UUID UNIQUE REFERENCES public.withdrawals(id) ON DELETE RESTRICT;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_transaction_type_check 
    CHECK (transaction_type IN ('deposit', 'refund', 'adjustment', 'withdrawal'));

-- 7. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('monthly_summary', 'financial_audit', 'excel_export', 'pdf_report')),
    period VARCHAR(50) NOT NULL,
    file_storage_path TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'completed' NOT NULL CHECK (status IN ('generating', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_group_period ON public.reports(group_id, period);

-- 8. Alter group_members to support temporary admin expiry
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS temp_admin_until TIMESTAMP WITH TIME ZONE;

-- Update is_group_admin helper function to include active temporary admin privileges
CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = _group_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
          AND (
            gm.role IN ('owner', 'treasurer')
            OR (gm.temp_admin_until IS NOT NULL AND gm.temp_admin_until > NOW())
          )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 9. Storage Buckets (reports, receipts)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('reports', 'reports', false, 52428800, ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf', 'text/csv']),
    ('receipts', 'receipts', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800;

-- 10. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.group_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies

-- group_settings
CREATE POLICY "Group members can view group settings"
ON public.group_settings FOR SELECT
TO authenticated
USING (public.is_group_member(group_id));

CREATE POLICY "Group admins can manage group settings"
ON public.group_settings FOR ALL
TO authenticated
USING (public.is_group_admin(group_id))
WITH CHECK (public.is_group_admin(group_id));

-- background_jobs
CREATE POLICY "Admins can view background jobs for their group"
ON public.background_jobs FOR SELECT
TO authenticated
USING (group_id IS NOT NULL AND public.is_group_admin(group_id));

CREATE POLICY "Service role full access on background_jobs"
ON public.background_jobs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- withdrawals
CREATE POLICY "Group members can view withdrawals"
ON public.withdrawals FOR SELECT
TO authenticated
USING (public.is_group_member(group_id));

CREATE POLICY "Active members can create withdrawals"
ON public.withdrawals FOR INSERT
TO authenticated
WITH CHECK (public.is_group_member(group_id));

CREATE POLICY "Admins or service can update withdrawals"
ON public.withdrawals FOR UPDATE
TO authenticated
USING (public.is_group_admin(group_id));

-- withdrawal_votes
CREATE POLICY "Group members can view withdrawal votes"
ON public.withdrawal_votes FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.withdrawals w
    WHERE w.id = withdrawal_votes.withdrawal_id
      AND public.is_group_member(w.group_id)
));

CREATE POLICY "Group members can vote on withdrawals"
ON public.withdrawal_votes FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM public.withdrawals w
    WHERE w.id = withdrawal_votes.withdrawal_id
      AND public.is_group_member(w.group_id)
));

CREATE POLICY "Group members can change their own vote"
ON public.withdrawal_votes FOR UPDATE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.withdrawals w
    JOIN public.group_members gm ON gm.group_id = w.group_id
    WHERE w.id = withdrawal_votes.withdrawal_id
      AND gm.id = withdrawal_votes.member_id
      AND gm.user_id = auth.uid()
));

-- reports
CREATE POLICY "Group members can view reports"
ON public.reports FOR SELECT
TO authenticated
USING (public.is_group_member(group_id));

CREATE POLICY "Admins or service can create reports"
ON public.reports FOR INSERT
TO authenticated, service_role
WITH CHECK (public.is_group_admin(group_id) OR auth.role() = 'service_role');

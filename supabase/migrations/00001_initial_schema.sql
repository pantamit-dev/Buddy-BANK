-- ==============================================================================
-- 00001_initial_schema.sql
-- Money Pool (Bank Buddy) - Core DDL Schema Migration
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table (Linked to LINE User ID and Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id VARCHAR(64) UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    picture_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_line_user_id ON public.profiles(line_user_id);

-- 2. Groups Table (One Active Pool per LINE Group)
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_group_id VARCHAR(64) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    target_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (target_amount >= 0),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'archived', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_groups_line_group_id ON public.groups(line_group_id);

-- 3. Group Members Table (Roster and Role Management)
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'treasurer', 'member', 'viewer')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending_approval', 'active', 'suspended')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_group_member UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_user ON public.group_members(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_status ON public.group_members(status);

-- 4. Deposits Table (Slip Intake and Verification State Machine)
CREATE TABLE IF NOT EXISTS public.deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
    slip_storage_path TEXT NOT NULL,
    raw_ocr_text TEXT,
    detected_amount NUMERIC(12, 2) CHECK (detected_amount IS NULL OR detected_amount >= 0),
    transfer_date TIMESTAMP WITH TIME ZONE,
    bank_reference VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'verified', 'rejected', 'cancelled')),
    click_count INT NOT NULL DEFAULT 0,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deposits_group_status ON public.deposits(group_id, status);
CREATE INDEX IF NOT EXISTS idx_deposits_bank_reference ON public.deposits(bank_reference);
CREATE INDEX IF NOT EXISTS idx_deposits_member ON public.deposits(member_id);

-- 5. Transactions Table (Confirmed Financial Events)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    deposit_id UUID UNIQUE NOT NULL REFERENCES public.deposits(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'deposit' CHECK (transaction_type IN ('deposit', 'refund', 'adjustment')),
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_group ON public.transactions(group_id);

-- 6. Ledger Entries Table (Append-Only Accounting Records)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE RESTRICT,
    member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE RESTRICT,
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('credit', 'debit')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    running_balance NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_group_entry ON public.ledger_entries(group_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_member ON public.ledger_entries(member_id);

-- Invariant Enforcement: Forbid direct UPDATE or DELETE on ledger_entries
CREATE OR REPLACE FUNCTION forbid_ledger_entries_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ledger entries are strictly immutable. UPDATE or DELETE operations are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forbid_ledger_mutation ON public.ledger_entries;
CREATE TRIGGER trg_forbid_ledger_mutation
BEFORE UPDATE OR DELETE ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION forbid_ledger_entries_mutation();

-- 7. Audit Logs Table (Tamper-evident system activity)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100),
    entity_id UUID,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_group ON public.audit_logs(group_id);

-- 8. Webhook Events Table (Event De-duplication and Traceability)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    event_id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON public.webhook_events(received_at);

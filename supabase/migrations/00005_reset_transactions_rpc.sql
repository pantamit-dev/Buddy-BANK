-- ==============================================================================
-- 00005_reset_transactions_rpc.sql
-- Money Pool (Bank Buddy) - Development Reset Transactions RPC
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.reset_group_transactions(target_group_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_ledger INT := 0;
    deleted_transactions INT := 0;
    deleted_deposits INT := 0;
    deleted_withdrawals INT := 0;
    deleted_votes INT := 0;
    deleted_reports INT := 0;
BEGIN
    -- 1. Temporarily disable the immutable trigger on ledger_entries
    ALTER TABLE public.ledger_entries DISABLE TRIGGER trg_forbid_ledger_mutation;

    IF target_group_id IS NOT NULL THEN
        -- Delete group specific transactions and records
        WITH del_l AS (
            DELETE FROM public.ledger_entries WHERE group_id = target_group_id RETURNING id
        ) SELECT count(*) INTO deleted_ledger FROM del_l;

        WITH del_t AS (
            DELETE FROM public.transactions WHERE group_id = target_group_id RETURNING id
        ) SELECT count(*) INTO deleted_transactions FROM del_t;

        WITH del_v AS (
            DELETE FROM public.withdrawal_votes 
            WHERE withdrawal_id IN (SELECT id FROM public.withdrawals WHERE group_id = target_group_id)
            RETURNING id
        ) SELECT count(*) INTO deleted_votes FROM del_v;

        WITH del_w AS (
            DELETE FROM public.withdrawals WHERE group_id = target_group_id RETURNING id
        ) SELECT count(*) INTO deleted_withdrawals FROM del_w;

        WITH del_d AS (
            DELETE FROM public.deposits WHERE group_id = target_group_id RETURNING id
        ) SELECT count(*) INTO deleted_deposits FROM del_d;

        WITH del_r AS (
            DELETE FROM public.reports WHERE group_id = target_group_id RETURNING id
        ) SELECT count(*) INTO deleted_reports FROM del_r;

        DELETE FROM public.audit_logs 
        WHERE group_id = target_group_id 
          AND entity_name IN ('deposits', 'transactions', 'ledger_entries', 'withdrawals');

        DELETE FROM public.background_jobs WHERE group_id = target_group_id;
    ELSE
        -- Delete all transactions across groups while preserving settings & profiles
        WITH del_l AS (DELETE FROM public.ledger_entries RETURNING id)
        SELECT count(*) INTO deleted_ledger FROM del_l;

        WITH del_t AS (DELETE FROM public.transactions RETURNING id)
        SELECT count(*) INTO deleted_transactions FROM del_t;

        WITH del_v AS (DELETE FROM public.withdrawal_votes RETURNING id)
        SELECT count(*) INTO deleted_votes FROM del_v;

        WITH del_w AS (DELETE FROM public.withdrawals RETURNING id)
        SELECT count(*) INTO deleted_withdrawals FROM del_w;

        WITH del_d AS (DELETE FROM public.deposits RETURNING id)
        SELECT count(*) INTO deleted_deposits FROM del_d;

        WITH del_r AS (DELETE FROM public.reports RETURNING id)
        SELECT count(*) INTO deleted_reports FROM del_r;

        DELETE FROM public.audit_logs 
        WHERE entity_name IN ('deposits', 'transactions', 'ledger_entries', 'withdrawals');

        DELETE FROM public.background_jobs;
    END IF;

    -- 2. Re-enable immutable trigger on ledger_entries
    ALTER TABLE public.ledger_entries ENABLE TRIGGER trg_forbid_ledger_mutation;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_ledger', deleted_ledger,
        'deleted_transactions', deleted_transactions,
        'deleted_deposits', deleted_deposits,
        'deleted_withdrawals', deleted_withdrawals,
        'deleted_votes', deleted_votes,
        'deleted_reports', deleted_reports
    );
EXCEPTION WHEN OTHERS THEN
    -- Ensure trigger is re-enabled if any error occurs
    ALTER TABLE public.ledger_entries ENABLE TRIGGER trg_forbid_ledger_mutation;
    RAISE;
END;
$$;

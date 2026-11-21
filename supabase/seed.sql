-- ==============================================================================
-- seed.sql
-- Money Pool (Bank Buddy) - Local Test Fixtures & Seed Data
-- ==============================================================================

-- Profiles: 1 Owner, 1 Treasurer, 2 Members
INSERT INTO public.profiles (id, line_user_id, display_name, picture_url)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'U_OWNER_001', 'Alice (Owner)', 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice'),
    ('22222222-2222-2222-2222-222222222222', 'U_TREASURER_002', 'Bob (Treasurer)', 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob'),
    ('33333333-3333-3333-3333-333333333333', 'U_MEMBER_003', 'Charlie (Member)', 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie'),
    ('44444444-4444-4444-4444-444444444444', 'U_MEMBER_004', 'David (Member)', 'https://api.dicebear.com/7.x/bottts/svg?seed=David')
ON CONFLICT (id) DO NOTHING;

-- Group: Japan Trip 2027 (Target: 50,000 THB)
INSERT INTO public.groups (id, line_group_id, name, target_amount, owner_id, status)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'C_GROUP_JAPAN_TRIP', 'ทริปญี่ปุ่น 2027 🌸', 50000.00, '11111111-1111-1111-1111-111111111111', 'active')
ON CONFLICT (id) DO NOTHING;

-- Target LINE Group: Cca9ff8bd835db5d10671e7777c19c61c
INSERT INTO public.groups (id, line_group_id, name, target_amount, owner_id, status)
VALUES
    ('c9ff8bd8-35db-5d10-671e-7777c19c61c0', 'Cca9ff8bd835db5d10671e7777c19c61c', 'กลุ่มกองกลาง (Cca9ff8bd...)', 20000.00, '11111111-1111-1111-1111-111111111111', 'active')
ON CONFLICT (line_group_id) DO NOTHING;

-- Group Members
INSERT INTO public.group_members (id, group_id, user_id, role, status)
VALUES
    ('ba111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
    ('ba222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'treasurer', 'active'),
    ('ba333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member', 'active'),
    ('ba444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member', 'pending_approval'),
    ('c9ff8bd8-35db-5d10-671e-7777c19c61c1', 'c9ff8bd8-35db-5d10-671e-7777c19c61c0', '11111111-1111-1111-1111-111111111111', 'owner', 'active')
ON CONFLICT (id) DO NOTHING;

-- Initial Verified Deposit & Ledger Entries
INSERT INTO public.deposits (id, group_id, member_id, slip_storage_path, raw_ocr_text, detected_amount, transfer_date, bank_reference, status, click_count, reviewed_by, reviewed_at, file_sha256, perceptual_hash, fraud_risk_score)
VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ba333333-3333-3333-3333-333333333333', 'slips/sample_slip_01.jpg', 'โอนเงินสำเร็จ 2,500.00 บาท วันที่ 21/11/2026 รหัสอ้างอิง KBANK20261121001', 2500.00, NOW() - INTERVAL '1 hour', 'KBANK20261121001', 'verified', 1, '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '50 minute', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'f0f0f0f0f0f0f0f0', 10)
ON CONFLICT (id) DO UPDATE SET
    file_sha256 = EXCLUDED.file_sha256,
    perceptual_hash = EXCLUDED.perceptual_hash,
    fraud_risk_score = EXCLUDED.fraud_risk_score;

INSERT INTO public.transactions (id, group_id, deposit_id, amount, transaction_type, confirmed_at)
VALUES
    ('ee111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 2500.00, 'deposit', NOW() - INTERVAL '50 minute')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ledger_entries (id, transaction_id, group_id, member_id, entry_type, amount, running_balance, created_at)
VALUES
    ('ee222222-2222-2222-2222-222222222222', 'ee111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ba333333-3333-3333-3333-333333333333', 'credit', 2500.00, 2500.00, NOW() - INTERVAL '50 minute')
ON CONFLICT (id) DO NOTHING;

-- Phase 2 & 3 Seed Data: Group Settings
INSERT INTO public.group_settings (id, group_id, rules, voting_quorum_percent, voting_duration_hours, updated_at)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"rule_type":"monthly_fixed","minimum_deposit":500,"monthly_due_day":28,"monthly_amount":2500,"excess_handling":"rollover","grace_period_days":3}'::jsonb, 66.00, 24, NOW())
ON CONFLICT (group_id) DO NOTHING;

-- Background Jobs
INSERT INTO public.background_jobs (id, group_id, job_type, payload, status, attempts, run_at, created_at)
VALUES
    ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'weekly_summary', '{"channel":"line_group"}'::jsonb, 'pending', 0, NOW() + INTERVAL '1 day', NOW())
ON CONFLICT (id) DO NOTHING;

-- Sample Withdrawal Request & Votes
INSERT INTO public.withdrawals (id, group_id, requested_by, amount, purpose, receipt_storage_path, status, expires_at, created_at)
VALUES
    ('c3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ba222222-2222-2222-2222-222222222222', 1200.00, 'ค่าจองที่พักล่วงหน้า (AirBnB)', 'receipts/airbnb_booking_receipt.pdf', 'pending_vote', NOW() + INTERVAL '24 hour', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.withdrawal_votes (id, withdrawal_id, member_id, vote_choice, voted_at)
VALUES
    ('c4444444-4444-4444-4444-444444444444', 'c3333333-3333-3333-3333-333333333333', 'ba111111-1111-1111-1111-111111111111', 'approve', NOW())
ON CONFLICT (id) DO NOTHING;

-- Sample Reports
INSERT INTO public.reports (id, group_id, report_type, period, file_storage_path, status, created_at)
VALUES
    ('c5555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'monthly_summary', '2026-11', 'reports/2026-11_monthly_summary.xlsx', 'completed', NOW())
ON CONFLICT (id) DO NOTHING;

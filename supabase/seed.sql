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

-- Group Members
INSERT INTO public.group_members (id, group_id, user_id, role, status)
VALUES
    ('ba111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
    ('ba222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'treasurer', 'active'),
    ('ba333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member', 'active'),
    ('ba444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member', 'pending_approval')
ON CONFLICT (id) DO NOTHING;

-- Initial Verified Deposit & Ledger Entries
INSERT INTO public.deposits (id, group_id, member_id, slip_storage_path, raw_ocr_text, detected_amount, transfer_date, bank_reference, status, click_count, reviewed_by, reviewed_at)
VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ba333333-3333-3333-3333-333333333333', 'slips/sample_slip_01.jpg', 'โอนเงินสำเร็จ 2,500.00 บาท วันที่ 21/11/2026 รหัสอ้างอิง KBANK20261121001', 2500.00, NOW() - INTERVAL '1 hour', 'KBANK20261121001', 'verified', 1, '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '50 minute')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.transactions (id, group_id, deposit_id, amount, transaction_type, confirmed_at)
VALUES
    ('ee111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 2500.00, 'deposit', NOW() - INTERVAL '50 minute')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ledger_entries (id, transaction_id, group_id, member_id, entry_type, amount, running_balance, created_at)
VALUES
    ('ee222222-2222-2222-2222-222222222222', 'ee111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ba333333-3333-3333-3333-333333333333', 'credit', 2500.00, 2500.00, NOW() - INTERVAL '50 minute')
ON CONFLICT (id) DO NOTHING;

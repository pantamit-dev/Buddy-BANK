-- ==============================================================================
-- 00002_rls_policies.sql
-- Money Pool (Bank Buddy) - Row Level Security (RLS) & RBAC Policies
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Helper Functions
CREATE OR REPLACE FUNCTION public.get_current_user_profile_id()
RETURNS UUID AS $$
BEGIN
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = _group_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = _group_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
          AND gm.role IN ('owner', 'treasurer')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 1. Profiles Policies
CREATE POLICY "Profiles are readable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users or service can insert profile"
ON public.profiles FOR INSERT
TO authenticated, anon, service_role
WITH CHECK (true);

-- 2. Groups Policies
CREATE POLICY "Members can view groups they belong to"
ON public.groups FOR SELECT
TO authenticated
USING (public.is_group_member(id) OR owner_id = auth.uid());

CREATE POLICY "Owners can update group settings"
ON public.groups FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR public.is_group_admin(id));

CREATE POLICY "Authenticated users can create a group"
ON public.groups FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- 3. Group Members Policies
CREATE POLICY "Members can view roster of their group"
ON public.group_members FOR SELECT
TO authenticated
USING (public.is_group_member(group_id) OR user_id = auth.uid());

CREATE POLICY "Users can register pending membership"
ON public.group_members FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending_approval');

CREATE POLICY "Group admins can manage membership and roles"
ON public.group_members FOR UPDATE
TO authenticated
USING (public.is_group_admin(group_id));

-- 4. Deposits Policies
CREATE POLICY "Group members can view deposits"
ON public.deposits FOR SELECT
TO authenticated
USING (public.is_group_member(group_id));

CREATE POLICY "Active members can create deposits"
ON public.deposits FOR INSERT
TO authenticated
WITH CHECK (public.is_group_member(group_id));

CREATE POLICY "Group admins can update deposits"
ON public.deposits FOR UPDATE
TO authenticated
USING (public.is_group_admin(group_id));

-- 5. Transactions Policies
CREATE POLICY "Group members can view transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (public.is_group_member(group_id));

CREATE POLICY "Admins or service can insert transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (public.is_group_admin(group_id));

-- 6. Ledger Entries Policies
CREATE POLICY "Group members can view ledger entries"
ON public.ledger_entries FOR SELECT
TO authenticated
USING (public.is_group_member(group_id));

CREATE POLICY "Admins or service can insert ledger entries"
ON public.ledger_entries FOR INSERT
TO authenticated
WITH CHECK (public.is_group_admin(group_id));

-- 7. Audit Logs Policies
CREATE POLICY "Group members can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.is_group_member(group_id));

CREATE POLICY "System can record audit logs"
ON public.audit_logs FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

-- 8. Webhook Events Policies
CREATE POLICY "Only service role can access webhook events"
ON public.webhook_events
TO service_role
USING (true)
WITH CHECK (true);

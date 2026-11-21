-- ==============================================================================
-- 00000_supabase_roles.sql
-- Money Pool (Bank Buddy) - Supabase Core Roles & Auth Setup
-- ==============================================================================

-- 1. Create Supabase Standard Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin LOGIN SUPERUSER PASSWORD 'postgrespassword';
    END IF;
END $$;

-- 2. Auth Schema & Helpers
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claim.role', true), '')::TEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Grant Permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

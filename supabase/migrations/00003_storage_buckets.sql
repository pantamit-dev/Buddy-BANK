-- ==============================================================================
-- 00003_storage_buckets.sql
-- Money Pool (Bank Buddy) - Private Storage Bucket Configuration
-- ==============================================================================

-- Ensure storage schema and tables exist for local Docker environment
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    public BOOLEAN DEFAULT FALSE,
    avif_autodetection BOOLEAN DEFAULT FALSE,
    file_size_limit BIGINT,
    allowed_mime_types TEXT[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT,
    name TEXT,
    owner UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Create private bucket for bank transfer slips
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'slips',
    'slips',
    false,
    52428800, -- 50 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800;

-- Storage RLS Policies for slips
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload slip images'
    ) THEN
        CREATE POLICY "Authenticated users can upload slip images"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'slips');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can read slip images'
    ) THEN
        CREATE POLICY "Users can read slip images"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (bucket_id = 'slips');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Service role full access to slips'
    ) THEN
        CREATE POLICY "Service role full access to slips"
        ON storage.objects FOR ALL
        TO service_role
        USING (bucket_id = 'slips')
        WITH CHECK (bucket_id = 'slips');
    END IF;
END $$;

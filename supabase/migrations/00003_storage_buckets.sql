-- ==============================================================================
-- 00003_storage_buckets.sql
-- Money Pool (Bank Buddy) - Private Storage Bucket Configuration
-- ==============================================================================

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
CREATE POLICY "Authenticated users can upload slip images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'slips');

CREATE POLICY "Users can read slip images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'slips');

CREATE POLICY "Service role full access to slips"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'slips')
WITH CHECK (bucket_id = 'slips');

-- Add attachments column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Create storage bucket for chat attachments if it doesn't exist
-- Note: This is usually done in the Supabase UI or via separate storage migration,
-- but we can try to do it here if using the storage schema extension
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files
CREATE POLICY "authenticated_uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- Policy to allow public access to view files
CREATE POLICY "public_view"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chat-attachments');

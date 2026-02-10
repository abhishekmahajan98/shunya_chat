-- Make storage_path nullable to support folders
ALTER TABLE documents ALTER COLUMN storage_path DROP NOT NULL;

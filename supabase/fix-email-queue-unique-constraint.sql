-- Allow multiple attachments from the same email to be queued.
-- Previously message_id was UNIQUE which blocked a second attachment
-- from the same email. We now use storage_path as the unique key
-- since it includes both messageId and filename.

ALTER TABLE email_queue 
DROP CONSTRAINT IF EXISTS email_queue_message_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS email_queue_storage_path_key 
ON email_queue (storage_path);

-- Email tracking columns for invitations
-- Tracks whether the invitation email was sent, when, and any errors.
-- No existing data is affected (all new columns are nullable with defaults).

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS email_sent_at     timestamptz  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_last_error  text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_send_count  integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_provider    text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_message_id  text         DEFAULT NULL;

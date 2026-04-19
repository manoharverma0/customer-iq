-- Run this in your Supabase SQL Editor to enable the Take Over functionality

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_paused BOOLEAN DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS taken_over_by TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS human_last_replied_at TIMESTAMPTZ;

-- Also ensure the messages table has a JSONB metadata column if it doesn't already
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

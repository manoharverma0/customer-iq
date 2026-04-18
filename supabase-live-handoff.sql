-- Run this in Supabase SQL Editor
-- Adds Human-in-the-Loop control columns to conversations

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_paused BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_last_replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS taken_over_by TEXT;

-- Index for fast lookup of paused conversations
CREATE INDEX IF NOT EXISTS idx_conversations_ai_paused
  ON conversations(ai_paused) WHERE ai_paused = true;

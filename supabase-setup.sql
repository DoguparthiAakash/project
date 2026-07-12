-- ═══════════════════════════════════════════════════════════════════════
--  CodeSage AI — Complete Supabase Database Setup
--  Run this entire script once in the Supabase SQL Editor.
--  Project: https://supabase.com/dashboard
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. git_profiles ─────────────────────────────────────────────────────────
--  Stores OAuth tokens and PATs for GitHub, GitLab, Bitbucket, Codeberg.
--  Primary key is (user_id, provider) so one user can connect multiple providers.
--  user_id is the GitHub numeric user ID (string) from the first OAuth login.

CREATE TABLE IF NOT EXISTS public.git_profiles (
  user_id       text        NOT NULL,    -- Primary user ID (GitHub numeric ID as text)
  provider      text        NOT NULL,    -- 'github' | 'gitlab' | 'bitbucket' | 'codeberg'
  provider_id   text,                    -- User ID on that specific platform
  login         text,                    -- Username / login on that platform
  name          text,                    -- Display name
  avatar        text,                    -- Avatar URL
  email         text,                    -- Email address
  token         text        NOT NULL,    -- OAuth access token or PAT
  token_scope   text        DEFAULT '',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

-- Trigger: keep updated_at fresh on row changes
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
$$;

DROP TRIGGER IF EXISTS git_profiles_updated_at ON public.git_profiles;
CREATE TRIGGER git_profiles_updated_at
  BEFORE UPDATE ON public.git_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. chat_threads ─────────────────────────────────────────────────────────
--  One thread = one persistent conversation about a specific repository.

CREATE TABLE IF NOT EXISTS public.chat_threads (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     text        NOT NULL,   -- references git_profiles.user_id
  owner       text        NOT NULL,   -- GitHub org/user that owns the repo
  repo        text        NOT NULL,
  title       text        NOT NULL DEFAULT 'New Chat',
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_user_repo
  ON public.chat_threads (user_id, owner, repo);

DROP TRIGGER IF EXISTS chat_threads_updated_at ON public.chat_threads;
CREATE TRIGGER chat_threads_updated_at
  BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. chat_history ─────────────────────────────────────────────────────────
--  Individual messages within a thread.
--  fixes JSONB: array of { path, content } objects for AI-suggested code changes.
--  attachments JSONB: array of base64 image strings.

CREATE TABLE IF NOT EXISTS public.chat_history (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id   uuid        REFERENCES public.chat_threads(id) ON DELETE CASCADE NOT NULL,
  user_id     text        NOT NULL,
  owner       text        NOT NULL,
  repo        text        NOT NULL,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     text        NOT NULL,
  fixes       jsonb       DEFAULT '[]'::jsonb,
  attachments jsonb       DEFAULT '[]'::jsonb,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_history_thread
  ON public.chat_history (thread_id, created_at);

-- ─── 4. Row Level Security ────────────────────────────────────────────────────
--  The backend uses the SERVICE_ROLE key (bypasses RLS).
--  RLS is still good practice to prevent direct client access to raw tokens.

ALTER TABLE public.git_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses all policies, so the backend can do anything.
-- No additional policies needed unless you want anon/authenticated client access.

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- After running this script:
-- 1. Copy your Supabase URL and keys into server/.env:
--      SUPABASE_URL=https://<ref>.supabase.co
--      SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
-- 2. Copy your anon key into the frontend .env:
--      VITE_SUPABASE_URL=https://<ref>.supabase.co
--      VITE_SUPABASE_ANON_KEY=<anon_key>

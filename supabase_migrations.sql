-- Migration: Chat Workspaces & History

-- 1. Create chat_threads table
CREATE TABLE IF NOT EXISTS public.chat_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT REFERENCES public.github_profiles(id) ON DELETE CASCADE,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for querying threads by user and repo
CREATE INDEX IF NOT EXISTS idx_chat_threads_user_repo 
ON public.chat_threads (user_id, owner, repo);

-- 2. Create chat_history table
CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID REFERENCES public.chat_threads(id) ON DELETE CASCADE NOT NULL,
    user_id TEXT REFERENCES public.github_profiles(id) ON DELETE CASCADE,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    fixes JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for querying history by thread
CREATE INDEX IF NOT EXISTS idx_chat_history_thread 
ON public.chat_history (thread_id);

-- (Optional) If you had an old chat_history table without thread_id, you would need to drop it or migrate data. 
-- Since it failed to save earlier, we can assume dropping it (if it partially exists) is safe for a fresh start:
-- DROP TABLE IF EXISTS public.chat_history; 

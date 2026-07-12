/*
# GitHub Profiles Table

## Purpose
Stores GitHub OAuth tokens and user profile data for authenticated users who
connect their GitHub account via Supabase Auth.

## Tables
- `github_profiles`
  - `id` (uuid, PK) - matches auth.users.id
  - `github_login` (text) - GitHub username
  - `github_avatar_url` (text) - Avatar URL from GitHub
  - `github_token` (text) - OAuth access token (scoped to repo:read)
  - `github_name` (text) - Display name
  - `updated_at` (timestamptz) - Last token refresh time
  - `created_at` (timestamptz)

## Security
- RLS enabled. Each user can only read/write their own profile row.
- Token is stored server-side; only accessible to the owning user.

## Notes
1. Row is upserted on every GitHub OAuth sign-in via onAuthStateChange.
2. The provider_token (GitHub access token) is only available during the
   SIGNED_IN event with a GitHub provider — it must be captured and stored
   immediately, as Supabase does not persist it across sessions.
3. Default for id and user_id columns uses auth.uid() so inserts from
   the authenticated session don't need to pass the user id explicitly.
*/

CREATE TABLE IF NOT EXISTS github_profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  github_login text,
  github_avatar_url text,
  github_name text,
  github_token text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE github_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_github_profile" ON github_profiles;
CREATE POLICY "select_own_github_profile" ON github_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_github_profile" ON github_profiles;
CREATE POLICY "insert_own_github_profile" ON github_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_github_profile" ON github_profiles;
CREATE POLICY "update_own_github_profile" ON github_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_github_profile" ON github_profiles;
CREATE POLICY "delete_own_github_profile" ON github_profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

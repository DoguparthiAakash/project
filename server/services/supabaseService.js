/**
 * supabaseService.js
 *
 * Server-side Supabase admin client.
 * Uses the SERVICE_ROLE key so it can bypass RLS and read/write
 * the github_profiles table directly.
 *
 * Table schema (run once in Supabase SQL editor):
 * ─────────────────────────────────────────────────────────────
 * ─────────────────────────────────────────────────────────────
 * create table if not exists public.git_profiles (
 *   user_id        text,                      -- Primary User ID (e.g. GitHub ID)
 *   provider       text,                      -- 'github', 'gitlab', 'bitbucket', 'codeberg'
 *   provider_id    text,                      -- The ID on that platform
 *   login          text,
 *   name           text,
 *   avatar         text,
 *   email          text,
 *   token          text not null,             -- OAuth or PAT
 *   token_scope    text default '',
 *   created_at     timestamptz default now(),
 *   updated_at     timestamptz default now(),
 *   primary key (user_id, provider)
 * );
 * ─────────────────────────────────────────────────────────────
 */
import { createClient } from "@supabase/supabase-js"
import fetch from "node-fetch"

let _client = null

function getClient() {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. " +
      "Get them from your Supabase project → Settings → API."
    )
  }
  _client = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: fetch }
  })
  return _client
}

/**
 * Upsert a Git provider profile + token into Supabase.
 * @param {string} userId - The primary user ID (from the JWT cookie)
 * @param {string} provider - 'github', 'gitlab', 'bitbucket', 'codeberg'
 * @param {{ id, login, name, avatar, email, token, scope }} profile
 */
export async function upsertGitProfile(userId, provider, { id, login, name, avatar, email, token, scope }) {
  const sb = getClient()
  const { error } = await sb
    .from("git_profiles")
    .upsert(
      {
        user_id:       userId,
        provider:      provider,
        provider_id:   id,
        login:         login,
        name:          name,
        avatar:        avatar,
        email:         email,
        token:         token,
        token_scope:   scope || "",
      },
      { onConflict: "user_id, provider" }
    )
  if (error) throw new Error(`Supabase upsert failed: ${error.message}`)
}

/**
 * Fetch a Git profile row for a specific user and provider.
 * Returns null if not found.
 */
export async function getGitProfile(userId, provider) {
  const sb = getClient()
  const { data, error } = await sb
    .from("git_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle()
  if (error) throw new Error(`Supabase fetch failed: ${error.message}`)
  return data          // null when not found
}

/**
 * Fetch all connected Git profiles for a user.
 */
export async function getAllGitProfiles(userId) {
  const sb = getClient()
  const { data, error } = await sb
    .from("git_profiles")
    .select("provider, provider_id, login, name, avatar, email")
    .eq("user_id", userId)
  if (error) throw new Error(`Supabase fetch failed: ${error.message}`)
  return data || []
}

/**
 * Fetch only the token for a user id and provider.
 * Throws if the user is not found.
 */
export async function getGitToken(userId, provider) {
  const row = await getGitProfile(userId, provider)
  if (!row) throw new Error(`User not found or ${provider} not connected`)
  if (!row.token) throw new Error(`No ${provider} token stored for this user`)
  return row.token
}

// ─── Legacy GitHub functions mapping to the new table ─────────────────────

export async function upsertGitHubProfile(profile) {
  // If this is the primary login, user_id is the github id
  return upsertGitProfile(profile.id, "github", profile)
}

export async function getGitHubProfile(id) {
  const data = await getGitProfile(id, "github")
  if (!data) return null
  return {
    id: data.provider_id,
    github_login: data.login,
    github_name: data.name,
    github_avatar: data.avatar,
    github_email: data.email,
    github_token: data.token,
    token_scope: data.token_scope
  }
}

export async function getGitHubToken(id) {
  return getGitToken(id, "github")
}

/**
 * Delete a profile row (used on logout if desired).
 * Token is revoked separately via the GitHub API before calling this.
 */
export async function deleteGitHubProfile(id) {
  const sb = getClient()
  const { error } = await sb
    .from("github_profiles")
    .delete()
    .eq("id", id)
  if (error) throw new Error(`Supabase delete failed: ${error.message}`)
}

/**
 * Fetch all chat threads for a user.
 */
export async function getChatThreads(userId) {
  const sb = getClient()
  const { data, error } = await sb
    .from("chat_threads")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
  
  if (error) throw new Error(`Failed to fetch chat threads: ${error.message}`)
  return data
}

/**
 * Create a new chat thread.
 */
export async function createChatThread(userId, owner, repo, title = "New Chat") {
  const sb = getClient()
  const { data, error } = await sb
    .from("chat_threads")
    .insert([{ user_id: userId, owner, repo, title }])
    .select()
    .single()
  
  if (error) throw new Error(`Failed to create chat thread: ${error.message}`)
  return data
}

/**
 * Fetch chat history for a specific thread.
 */
export async function getThreadHistory(userId, threadId) {
  const sb = getClient()
  const { data, error } = await sb
    .from("chat_history")
    .select("*")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
  
  if (error) throw new Error(`Failed to fetch thread history: ${error.message}`)
  return data
}

/**
 * Save a new chat message to a thread and update its updated_at timestamp.
 */
export async function saveChatMessage(userId, threadId, owner, repo, role, content, fixes = [], attachments = []) {
  const sb = getClient()
  
  // Insert the message
  const { error: insertError } = await sb
    .from("chat_history")
    .insert([{
      thread_id: threadId,
      user_id: userId,
      owner,
      repo,
      role,
      content,
      fixes,
      attachments
    }])
  
  if (insertError) throw new Error(`Failed to save chat message: ${insertError.message}`)

  // Update the thread's updated_at
  const { error: updateError } = await sb
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId)

  if (updateError) console.error("Failed to update thread timestamp:", updateError)
}

/**
 * Delete a specific chat thread.
 */
export async function deleteChatThread(userId, threadId) {
  const sb = getClient()
  const { error } = await sb
    .from("chat_threads")
    .delete()
    .eq("user_id", userId)
    .eq("id", threadId)
  
  if (error) throw new Error(`Failed to delete chat thread: ${error.message}`)
}

/**
 * Clear all chat history (delete all threads) for a specific user and repository.
 */
export async function clearChatHistory(userId, owner, repo) {
  const sb = getClient()
  const { error } = await sb
    .from("chat_threads")
    .delete()
    .eq("user_id", userId)
    .eq("owner", owner)
    .eq("repo", repo)
  
  if (error) throw new Error(`Failed to clear chat history: ${error.message}`)
}

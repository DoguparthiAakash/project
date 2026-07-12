import * as github from "./githubService.js"
import { getGitToken } from "./supabaseService.js"

// We will implement full GitLab/Bitbucket/Gitea adapters later.
// For now, we stub them to throw "Not implemented" or fallback to basic functionality.

const providers = {
  github,
  gitlab: {
    listRepos: async () => { throw new Error("GitLab integration coming soon") },
    createRepo: async () => { throw new Error("GitLab integration coming soon") },
    getContents: async () => { throw new Error("GitLab integration coming soon") },
    getFileContent: async () => { throw new Error("GitLab integration coming soon") },
    listBranches: async () => { throw new Error("GitLab integration coming soon") },
    getRepo: async () => { throw new Error("GitLab integration coming soon") },
    commitFile: async () => { throw new Error("GitLab integration coming soon") },
    commentOnPR: async () => { throw new Error("GitLab integration coming soon") },
    listPRs: async () => { throw new Error("GitLab integration coming soon") },
    getRepoTree: async () => { throw new Error("GitLab integration coming soon") },
    commitMultipleFiles: async () => { throw new Error("GitLab integration coming soon") },
  },
  bitbucket: {
    // Stub
  },
  codeberg: {
    // Stub
  }
}

export function getProviderAdapter(providerName) {
  const adapter = providers[providerName] || providers.github
  return adapter
}

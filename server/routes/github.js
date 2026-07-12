import { Router } from "express"
import {
  handleListRepos,
  handleGetContents,
  handleGetFile,
  handleListBranches,
  handleGetRepo,
  handleCreateRepo,
  handleCommitFile,
  handleCommentOnPR,
  handleListPRs,
} from "../controllers/githubController.js"

const router = Router()

// Repos
router.get("/repos",                           handleListRepos)
router.post("/repos/create",                   handleCreateRepo)
router.get("/repos/:owner/:repo",              handleGetRepo)

// Contents / file tree
router.get("/repos/:owner/:repo/contents",     handleGetContents)
router.get("/repos/:owner/:repo/file",         handleGetFile)

// Branches
router.get("/repos/:owner/:repo/branches",     handleListBranches)

// Commit optimized code back to GitHub
router.post("/repos/commit",                   handleCommitFile)

// Pull requests
router.get("/repos/:owner/:repo/pulls",        handleListPRs)
router.post("/repos/pulls/comment",            handleCommentOnPR)

export default router
